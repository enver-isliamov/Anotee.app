
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
          // 1. Fetch Org Memberships
          let orgIds = [];
          if (user.isVerified && user.userId) {
              try {
                  const clerk = getClerkClient();
                  const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                  orgIds = memberships.data.map(m => m.organization.id);
              } catch (e) {
                  console.warn("Failed to fetch org memberships", e.message);
              }
          }

          // 2. Query projects
          let query;
          
          if (orgIds.length > 0) {
              const { rows } = await sql`
                SELECT data, org_id FROM projects 
                WHERE owner_id = ${user.id} 
                OR org_id = ANY(${orgIds}) 
                OR (org_id IS NULL AND owner_id = ${user.id})
                OR (
                    jsonb_typeof(data->'team') = 'array' 
                    AND EXISTS (
                        SELECT 1 
                        FROM jsonb_array_elements(data->'team') AS member 
                        WHERE member->>'id' = ${user.id}
                    )
                );
              `;
              query = rows;
          } else {
              // Strict personal query: Owner OR Legacy Team membership
              const { rows } = await sql`
                SELECT data, org_id FROM projects 
                WHERE owner_id = ${user.id}
                OR (
                    jsonb_typeof(data->'team') = 'array' 
                    AND EXISTS (
                        SELECT 1 
                        FROM jsonb_array_elements(data->'team') AS member 
                        WHERE member->>'id' = ${user.id}
                    )
                );
              `;
              query = rows;
          }

          // Map and ensure orgId is present in JSON if DB column has it
          const projects = query.map(r => {
              const p = r.data;
              if (r.org_id && !p.orgId) p.orgId = r.org_id;
              // Ensure we return clean project objects
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
      
      // POST: Sync Projects (Upsert with Optimistic Locking & Security Checks)
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
            
            // SECURITY: Enforce that only the authenticated user can be set as owner for new projects
            // For existing projects, we check ownership in the WHERE clause.
            const ownerId = project.ownerId || user.id;

            try {
                // 1. Try UPDATE with Version Check AND Ownership Check
                // We allow update if:
                // a) User is the owner (owner_id = user.id)
                // b) Project belongs to an Org the user is part of (org_id IN orgIds)
                // c) User is in the 'team' array (handled loosely here for legacy, but ideally strict)
                
                // Construct Org Check
                const hasOrgAccess = orgIds.length > 0 && orgId ? orgIds.includes(orgId) : false;

                let updateResult;
                
                if (hasOrgAccess) {
                     // If Org Match, we allow update regardless of individual owner_id
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
                    // 2. If Update failed, check if it's an INSERT (id doesn't exist)
                    // OR a Conflict (id exists but version mismatch) OR Permission Denied
                    
                    const checkExists = await sql`SELECT data->>'_version' as ver, owner_id FROM projects WHERE id = ${project.id}`;
                    
                    if (checkExists.rowCount === 0) {
                        // Does not exist -> INSERT
                        // SECURITY: Force owner_id to be current user on creation
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
                        // Exists. Check if it was a permission issue or version conflict
                        const dbRow = checkExists.rows[0];
                        const isOwner = dbRow.owner_id === user.id;
                        
                        if (!isOwner && !hasOrgAccess) {
                             // Silent fail or continue, do not expose error details for security
                             console.warn(`Unauthorized update attempt on ${project.id} by ${user.id}`);
                             continue; 
                        }

                        // Version Conflict
                        const dbVer = parseInt(dbRow.ver || '0');
                        console.warn(`Conflict for ${project.id}: Client ${clientVersion} vs DB ${dbVer}`);
                        
                        return res.status(409).json({ 
                            error: "Version Conflict", 
                            projectId: project.id,
                            serverVersion: dbVer,
                            clientVersion: clientVersion
                        });
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
