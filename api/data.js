
import { sql } from '@vercel/postgres';
import { verifyUser, getClerkClient } from './_auth.js';

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
          const targetOrgId = req.query.orgId; // Optional filter

          // 1. Fetch Org Memberships to verify access
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

          // Security: If requesting a specific Org, user MUST be a member
          if (targetOrgId && !userOrgIds.includes(targetOrgId)) {
              // Return empty if user tries to access an Org they are not part of
              return res.status(200).json([]);
          }

          let query;
          
          if (targetOrgId) {
              // A. Organization View (Filtered)
              const { rows } = await sql`
                SELECT data, org_id FROM projects 
                WHERE org_id = ${targetOrgId}
              `;
              query = rows;
          } else {
              // B. Personal Workspace View (No Org)
              // Show projects where org_id is NULL OR owner_id matches (legacy support)
              const { rows } = await sql`
                SELECT data, org_id FROM projects 
                WHERE (org_id IS NULL OR org_id = '') 
                AND (owner_id = ${user.id})
              `;
              query = rows;
          }

          // Map and ensure orgId is present in JSON if DB column has it
          const projects = query.map(r => {
              const p = r.data;
              if (r.org_id && !p.orgId) p.orgId = r.org_id;
              return p;
          });
          
          return res.status(200).json(projects);

        } catch (dbError) {
           if (isDbConnectionError(dbError)) return res.status(503).json({ error: "DB Offline", code: "DB_OFFLINE" });
           if (dbError.code === '42P01') return res.status(200).json([]); // Table doesn't exist yet
           console.error("DB GET Error:", dbError); 
           return res.status(500).json({ error: "Database error" });
        }
      } 
      
      // PATCH: Partial Updates (Smart Merge)
      // Allows updating specific fields (like name, description) without overwriting assets
      if (req.method === 'PATCH') {
          const { projectId, updates, _version } = req.body;
          
          if (!projectId || !updates) return res.status(400).json({ error: "Missing projectId or updates" });

          // 1. Fetch current data
          const { rows } = await sql`SELECT data, owner_id, org_id FROM projects WHERE id = ${projectId}`;
          
          if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
          
          const currentDbData = rows[0].data;
          const dbOwnerId = rows[0].owner_id;
          const dbOrgId = rows[0].org_id;
          
          // 2. Permission Check
          let hasAccess = false;
          if (dbOwnerId === user.id) hasAccess = true;
          else if (dbOrgId) {
               // Verify Org Access
               const clerk = getClerkClient();
               try {
                   const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                   const userOrgs = memberships.data.map(m => m.organization.id);
                   if (userOrgs.includes(dbOrgId)) hasAccess = true;
               } catch(e) { console.error(e); }
          }
          
          if (!hasAccess) return res.status(403).json({ error: "Forbidden" });

          // 3. Version Check (Optimistic Locking)
          const currentVer = currentDbData._version || 0;
          if (_version !== undefined && currentVer !== _version) {
              return res.status(409).json({ error: "Conflict", serverVersion: currentVer, clientVersion: _version });
          }

          // 4. Merge Data (Server-Side)
          // This ensures that if 'assets' are NOT in updates, they remain untouched in DB
          const newData = {
              ...currentDbData,
              ...updates,
              _version: currentVer + 1, // Increment version
              updatedAt: 'Just now'
          };

          // 5. Save
          await sql`
            UPDATE projects 
            SET data = ${JSON.stringify(newData)}::jsonb, updated_at = ${Date.now()}
            WHERE id = ${projectId}
          `;

          return res.status(200).json({ success: true, project: newData });
      }

      // POST: Full Sync / Create
      if (req.method === 'POST') {
        let projectsToSync = req.body;
        if (typeof projectsToSync === 'string') try { projectsToSync = JSON.parse(projectsToSync); } catch(e) {}
        
        if (!Array.isArray(projectsToSync)) return res.status(400).json({ error: "Expected array" });

        // Refresh permissions
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
            project._version = newVersion; // Inject new version into JSON

            const projectJson = JSON.stringify(project);
            const orgId = project.orgId || null;
            
            try {
                const hasOrgAccess = orgIds.length > 0 && orgId ? orgIds.includes(orgId) : false;

                let updateResult;
                
                if (hasOrgAccess) {
                     // If Org Match, we allow update
                     updateResult = await sql`
                        UPDATE projects 
                        SET 
                            data = ${projectJson}::jsonb,
                            org_id = ${orgId},
                            updated_at = ${Date.now()}
                        WHERE id = ${project.id} 
                        AND (org_id = ${orgId})
                        AND ((data->>'_version')::int = ${clientVersion} OR data->>'_version' IS NULL);
                    `;
                } else {
                    // Personal Project: Must be owner
                    updateResult = await sql`
                        UPDATE projects 
                        SET 
                            data = ${projectJson}::jsonb,
                            org_id = ${orgId},
                            updated_at = ${Date.now()}
                        WHERE id = ${project.id} 
                        AND owner_id = ${user.id}
                        AND ((data->>'_version')::int = ${clientVersion} OR data->>'_version' IS NULL);
                    `;
                }

                if (updateResult.rowCount > 0) {
                    updatesResults.push({ id: project.id, _version: newVersion, status: 'updated' });
                } else {
                    const checkExists = await sql`SELECT data->>'_version' as ver, owner_id FROM projects WHERE id = ${project.id}`;
                    
                    if (checkExists.rowCount === 0) {
                        // Does not exist -> INSERT
                        await sql`
                            INSERT INTO projects (id, owner_id, org_id, data, updated_at, created_at)
                            VALUES (
                                ${project.id}, 
                                ${user.id}, 
                                ${orgId},
                                ${projectJson}::jsonb, 
                                ${Date.now()}, 
                                ${project.createdAt || Date.now()}
                            );
                        `;
                        updatesResults.push({ id: project.id, _version: newVersion, status: 'created' });
                    } else {
                        // Conflict
                        const dbRow = checkExists.rows[0];
                        const dbVer = parseInt(dbRow.ver || '0');
                        return res.status(409).json({ error: "Version Conflict", projectId: project.id });
                    }
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
