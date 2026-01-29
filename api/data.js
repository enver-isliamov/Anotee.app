
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
      
      // POST: Sync Projects (Upsert)
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

        for (const project of projectsToSync) {
            if (!project.id) continue;

            const isOwner = project.ownerId === user.id;
            const isTeam = project.team && Array.isArray(project.team) && project.team.some(m => m.id === user.id);
            const isOrgMember = project.orgId && orgIds.includes(project.orgId);
            
            if (isOwner || isTeam || isOrgMember) {
                const projectJson = JSON.stringify(project);
                const orgId = project.orgId || null;
                
                try {
                    await sql`
                        INSERT INTO projects (id, owner_id, org_id, data, updated_at, created_at)
                        VALUES (
                            ${project.id}, 
                            ${project.ownerId || user.id}, 
                            ${orgId},
                            ${projectJson}::jsonb, 
                            ${Date.now()}, 
                            ${project.createdAt || Date.now()}
                        )
                        ON CONFLICT (id) 
                        DO UPDATE SET 
                            data = ${projectJson}::jsonb,
                            org_id = ${orgId},
                            updated_at = ${Date.now()};
                    `;
                } catch (dbError) {
                    if (isDbConnectionError(dbError)) return res.status(503).json({ error: "DB Offline" });
                    if (dbError.code === '42P01') {
                        // Silent retry logic omitted for brevity
                        throw dbError;
                    } 
                    throw dbError;
                }
            }
        }
        return res.status(200).json({ success: true });
      }

      return res.status(405).send("Method not allowed");

  } catch (globalError) {
      console.error("API Error:", globalError);
      return res.status(500).json({ error: "Server Error" });
  }
}
