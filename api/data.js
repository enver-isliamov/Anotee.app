
import { sql } from '@vercel/postgres';
import { verifyUser, getClerkClient } from './_auth.js';
import { checkProjectAccess } from './_permissions.js';

const isDbConnectionError = (err) => {
    return err.message && (
        err.message.includes('HTTP status 404') || 
        err.message.includes('does not exist') ||
        err.code === 'ENOTFOUND'
    );
};

export default async function handler(req, res) {
  try {
      const user = await verifyUser(req);
      
      if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
      }

      // GET: Retrieve Projects
      if (req.method === 'GET') {
        try {
          const targetOrgId = req.query.orgId;
          const specificProjectId = req.query.projectId;

          // 1. Fetch Org Memberships to verify access for LIST requests
          let userOrgIds = [];
          if (user.isVerified && user.userId) {
              try {
                  const clerk = getClerkClient();
                  const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                  userOrgIds = memberships.data.map(m => m.organization.id);
              } catch (e) {
                  console.warn("Failed to fetch org memberships", e.message);
              }
          }

          let query;

          if (specificProjectId) {
              // --- SINGLE PROJECT FETCH ---
              // Uses stricter check or Public Access
              const { rows } = await sql`SELECT data, owner_id, org_id FROM projects WHERE id = ${specificProjectId}`;
              
              if (rows.length > 0) {
                  const projectRow = rows[0];
                  // Public Access Check
                  if (projectRow.data?.publicAccess === 'view') {
                      query = [projectRow];
                  } else {
                      // Private Access Check
                      const hasAccess = await checkProjectAccess(user, projectRow);
                      query = hasAccess ? [projectRow] : [];
                  }
              } else {
                  query = [];
              }

          } else if (targetOrgId) {
              // --- ORG LIST FETCH ---
              if (!userOrgIds.includes(targetOrgId)) {
                  return res.status(200).json([]);
              }
              const { rows } = await sql`
                SELECT data, org_id FROM projects 
                WHERE org_id = ${targetOrgId}
              `;
              query = rows;
          } else {
              // --- PERSONAL WORKSPACE FETCH ---
              // Only show projects I own or am explicitly part of the team.
              const { rows } = await sql`
                SELECT data, org_id FROM projects 
                WHERE (org_id IS NULL OR org_id = '') 
                AND (
                    owner_id = ${user.id} 
                    OR 
                    data->'team' @> ${JSON.stringify([{id: user.id}])}::jsonb
                )
              `;
              query = rows;
          }

          const projects = query.map(r => {
              const p = r.data;
              if (r.org_id && !p.orgId) p.orgId = r.org_id;
              return p;
          });
          
          return res.status(200).json(projects);

        } catch (dbError) {
           if (isDbConnectionError(dbError)) return res.status(503).json({ error: "DB Offline", code: "DB_OFFLINE" });
           if (dbError.code === '42P01') return res.status(200).json([]); 
           console.error("DB GET Error:", dbError); 
           return res.status(500).json({ error: "Database error" });
        }
      } 
      
      // PATCH: Partial Updates
      if (req.method === 'PATCH') {
          const { projectId, updates, _version } = req.body;
          if (!projectId || !updates) return res.status(400).json({ error: "Missing projectId or updates" });

          const { rows } = await sql`SELECT data, owner_id, org_id FROM projects WHERE id = ${projectId}`;
          if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
          
          const hasAccess = await checkProjectAccess(user, rows[0]);
          if (!hasAccess) return res.status(403).json({ error: "Forbidden" });

          const currentDbData = rows[0].data;
          const currentVer = currentDbData._version || 0;
          
          if (_version !== undefined && currentVer !== _version) {
              return res.status(409).json({ error: "Conflict", serverVersion: currentVer, clientVersion: _version });
          }

          const newData = {
              ...currentDbData,
              ...updates,
              _version: currentVer + 1, 
              updatedAt: 'Just now'
          };

          await sql`
            UPDATE projects 
            SET data = ${JSON.stringify(newData)}::jsonb, updated_at = ${Date.now()}
            WHERE id = ${projectId}
          `;

          return res.status(200).json({ success: true, project: newData });
      }

      // POST: Upsert (Single or Array)
      if (req.method === 'POST') {
        let projectsToSync = req.body;
        if (typeof projectsToSync === 'string') try { projectsToSync = JSON.parse(projectsToSync); } catch(e) {}
        if (!Array.isArray(projectsToSync)) projectsToSync = [projectsToSync]; 

        // Pre-fetch org memberships to optimize loop
        let orgIds = [];
        if (user.isVerified && user.userId) {
            try {
                const clerk = getClerkClient();
                const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                orgIds = memberships.data.map(m => m.organization.id);
            } catch (e) {}
        }

        const updatesResults = [];

        for (const project of projectsToSync) {
            if (!project.id) continue;

            const clientVersion = project._version || 0;
            const newVersion = clientVersion + 1;
            project._version = newVersion; 

            const projectJson = JSON.stringify(project);
            const orgId = project.orgId || null;
            
            try {
                // Determine Access Logic for Update
                // If existing project, check access. If new, allow.
                const checkExists = await sql`SELECT owner_id, org_id, data FROM projects WHERE id = ${project.id}`;
                
                if (checkExists.rowCount > 0) {
                    const hasAccess = await checkProjectAccess(user, checkExists.rows[0]);
                    if (!hasAccess) continue; // Skip unauthorized updates
                    
                    await sql`
                        UPDATE projects 
                        SET data = ${projectJson}::jsonb, org_id = ${orgId}, updated_at = ${Date.now()}
                        WHERE id = ${project.id}
                        AND ((data->>'_version')::int = ${clientVersion} OR data->>'_version' IS NULL);
                    `;
                    updatesResults.push({ id: project.id, _version: newVersion, status: 'updated' });
                } else {
                    // Create New
                    // Validate Org Access if orgId is set
                    if (orgId && !orgIds.includes(orgId)) {
                        continue; // Cannot create in org you don't belong to
                    }

                    await sql`
                        INSERT INTO projects (id, owner_id, org_id, data, updated_at, created_at)
                        VALUES (${project.id}, ${user.id}, ${orgId}, ${projectJson}::jsonb, ${Date.now()}, ${project.createdAt || Date.now()});
                    `;
                    updatesResults.push({ id: project.id, _version: newVersion, status: 'created' });
                }
            } catch (dbError) {
                if (isDbConnectionError(dbError)) return res.status(503).json({ error: "DB Offline" });
                console.error("DB Sync Error", dbError);
                throw dbError;
            }
        }
        
        return res.status(200).json({ success: true, updates: updatesResults });
      }

      return res.status(405).send("Method not allowed");

  } catch (globalError) {
      console.error("API Error:", globalError);
      return res.status(500).json({ error: "Server Error" });
  }
}
