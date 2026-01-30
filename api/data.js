
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
      // FORCE EMAIL FETCH: Required for "Shared with Me" personal invites to work.
      // NOTE: This increases Clerk API usage. Client-side polling interval has been increased to mitigate 429 errors.
      const requireEmail = true; 
      const user = await verifyUser(req, requireEmail);
      
      if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
      }

      // --- DELETE: Remove Project Row ---
      if (req.method === 'DELETE') {
          const { projectId } = req.query;
          if (!projectId) return res.status(400).json({ error: "Missing projectId" });

          const { rows } = await sql`SELECT owner_id, org_id, data FROM projects WHERE id = ${projectId}`;
          if (rows.length === 0) return res.status(404).json({ error: "Project not found" });

          const projectRow = rows[0];
          
          let canDelete = false;
          
          // 1. Universal Owner Override
          // Check Clerk ID OR Legacy Email (if available)
          if (projectRow.owner_id === user.id || (user.email && projectRow.owner_id === user.email)) {
              canDelete = true;
          }
          // 2. Org Admin Check
          else if (projectRow.org_id) {
              try {
                  const clerk = getClerkClient();
                  const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                  const membership = memberships.data.find(m => m.organization.id === projectRow.org_id);
                  if (membership && membership.role === 'org:admin') canDelete = true;
              } catch(e) {
                  console.warn("Org check failed during delete", e);
              }
          }

          if (!canDelete) return res.status(403).json({ error: "Forbidden: Only Owner or Org Admin can delete projects." });

          await sql`DELETE FROM projects WHERE id = ${projectId}`;
          return res.status(200).json({ success: true });
      }

      // --- GET: Retrieve Projects ---
      if (req.method === 'GET') {
        try {
          const targetOrgId = req.query.orgId;
          const specificProjectId = req.query.projectId;

          let query;

          if (specificProjectId) {
              // --- SINGLE PROJECT FETCH ---
              const { rows } = await sql`SELECT data, owner_id, org_id FROM projects WHERE id = ${specificProjectId}`;
              
              if (rows.length > 0) {
                  const projectRow = rows[0];
                  // Public Access Check
                  if (projectRow.data?.publicAccess === 'view') {
                      query = [projectRow];
                  } else {
                      const hasAccess = await checkProjectAccess(user, projectRow);
                      query = hasAccess ? [projectRow] : [];
                  }
              } else {
                  query = [];
              }

          } else if (targetOrgId) {
              // --- ORG LIST FETCH ---
              const { rows } = await sql`
                SELECT data, org_id FROM projects 
                WHERE org_id = ${targetOrgId}
                ORDER BY updated_at DESC
              `;
              query = rows;
          } else {
              // --- PERSONAL WORKSPACE FETCH ---
              // Uses user.email to match "Shared with Me" projects via invites
              const userEmail = user.email || null;
              
              const { rows } = await sql`
                SELECT data, org_id FROM projects 
                WHERE (org_id IS NULL OR org_id = '') 
                AND (
                    owner_id = ${user.id} 
                    OR 
                    data->'team' @> ${JSON.stringify([{id: user.id}])}::jsonb
                    OR (
                        ${userEmail}::text IS NOT NULL 
                        AND EXISTS (
                            SELECT 1 FROM jsonb_array_elements(data->'team') AS member 
                            WHERE member->>'email' = ${userEmail}
                        )
                    )
                )
                ORDER BY updated_at DESC
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
           // Check for missing table error
           if (dbError.code === '42P01') return res.status(200).json([]); 
           
           console.error("DB GET Error:", dbError); 
           return res.status(500).json({ error: "Database error", code: dbError.code });
        }
      } 
      
      // --- PATCH: Partial Updates ---
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

      // --- POST: Upsert (Single or Array) ---
      if (req.method === 'POST') {
        let projectsToSync = req.body;
        if (typeof projectsToSync === 'string') try { projectsToSync = JSON.parse(projectsToSync); } catch(e) {}
        if (!Array.isArray(projectsToSync)) projectsToSync = [projectsToSync]; 

        const updatesResults = [];

        for (const project of projectsToSync) {
            if (!project.id) continue;

            const clientVersion = project._version || 0;
            const newVersion = clientVersion + 1;
            project._version = newVersion; 

            const projectJson = JSON.stringify(project);
            const orgId = project.orgId || null;
            
            try {
                const checkExists = await sql`SELECT owner_id, org_id, data FROM projects WHERE id = ${project.id}`;
                
                if (checkExists.rowCount > 0) {
                    const hasAccess = await checkProjectAccess(user, checkExists.rows[0]);
                    if (!hasAccess) continue; 
                    
                    await sql`
                        UPDATE projects 
                        SET data = ${projectJson}::jsonb, org_id = ${orgId}, updated_at = ${Date.now()}
                        WHERE id = ${project.id}
                        AND ((data->>'_version')::int = ${clientVersion} OR data->>'_version' IS NULL);
                    `;
                    updatesResults.push({ id: project.id, _version: newVersion, status: 'updated' });
                } else {
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
      console.error("API Fatal Error:", globalError);
      return res.status(500).json({ error: "Server Error" });
  }
}
