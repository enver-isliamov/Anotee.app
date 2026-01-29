
import { sql } from '@vercel/postgres';
import { verifyUser, getClerkClient } from './_auth.js';

// Helper to identify fatal DB connection errors
const isDbConnectionError = (err) => {
    return err.message && (
        err.message.includes('HTTP status 404') || 
        err.message.includes('does not exist') ||
        err.code === 'ENOTFOUND'
    );
};

// --- DB INIT HELPER ---
async function ensureProjectsTable() {
    try {
        await sql`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            data JSONB NOT NULL,
            updated_at BIGINT,
            created_at BIGINT
        );
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_owner_id ON projects (owner_id);`;
        console.log("✅ Table 'projects' ensured.");
    } catch (e) {
        if (isDbConnectionError(e)) {
            console.warn("⚠️ Database unavailable (404/Offline). Skipping table creation.");
            throw e; 
        }
        console.error("Failed to create table:", e);
        throw e;
    }
}

export default async function handler(req, res) {
  try {
      const user = await verifyUser(req);
      
      if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
      }

      // GET: Retrieve Projects
      if (req.method === 'GET') {
        try {
          // 1. If user is Clerk verified, fetch their Organization Memberships
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
          // Logic: 
          // - Owned by user (owner_id)
          // - OR Belong to an Org the user is member of (data->>'orgId' in orgIds)
          // - OR Legacy team array access (data->'team' contains user.id)
          
          let query;
          
          if (orgIds.length > 0) {
              // Use ANY for array matching in Postgres
              const { rows } = await sql`
                SELECT data FROM projects 
                WHERE owner_id = ${user.id} 
                OR data->>'orgId' = ANY(${orgIds})
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
              // Simple query without orgs
              const { rows } = await sql`
                SELECT data FROM projects 
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

          const projects = query.map(r => r.data);
          return res.status(200).json(projects);

        } catch (dbError) {
           if (isDbConnectionError(dbError)) {
               console.error("DB Connection Dead:", dbError.message);
               return res.status(503).json({ error: "Database Disconnected", code: "DB_OFFLINE" });
           }
           if (dbError.code === '42P01') {
               return res.status(200).json([]);
           }
           console.error("DB GET Error Details:", dbError); 
           return res.status(500).json({ error: "Database error", details: dbError.message });
        }
      } 
      
      // POST: Sync Projects (Upsert)
      if (req.method === 'POST') {
        
        let projectsToSync = req.body;
        if (typeof projectsToSync === 'string') {
            try { projectsToSync = JSON.parse(projectsToSync); } catch(e) {}
        }
        
        if (!Array.isArray(projectsToSync)) {
            return res.status(400).json({ error: "Expected array of projects" });
        }

        // Fetch Orgs again for Write permission check (security)
        let orgIds = [];
        if (user.isVerified && user.userId) {
            try {
                const clerk = getClerkClient();
                const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                orgIds = memberships.data.map(m => m.organization.id);
            } catch (e) {
                console.warn("Failed to fetch org memberships for write", e.message);
            }
        }

        for (const project of projectsToSync) {
            if (!project.id) continue;

            // Security: Can write if Owner OR Team Member OR Org Member
            const isOwner = project.ownerId === user.id;
            const isTeam = project.team && Array.isArray(project.team) && project.team.some(m => m.id === user.id);
            const isOrgMember = project.orgId && orgIds.includes(project.orgId);
            
            if (isOwner || isTeam || isOrgMember) {
                const projectJson = JSON.stringify(project);
                
                try {
                    await sql`
                        INSERT INTO projects (id, owner_id, data, updated_at, created_at)
                        VALUES (
                            ${project.id}, 
                            ${project.ownerId || user.id}, 
                            ${projectJson}::jsonb, 
                            ${Date.now()}, 
                            ${project.createdAt || Date.now()}
                        )
                        ON CONFLICT (id) 
                        DO UPDATE SET 
                            data = ${projectJson}::jsonb,
                            updated_at = ${Date.now()};
                    `;
                } catch (dbError) {
                    if (isDbConnectionError(dbError)) {
                        return res.status(503).json({ error: "Database Unavailable", code: "DB_OFFLINE" });
                    }

                    if (dbError.code === '42P01') {
                        console.warn("Table missing, attempting creation...");
                        try {
                            await ensureProjectsTable();
                            // Retry insert
                            await sql`
                                INSERT INTO projects (id, owner_id, data, updated_at, created_at)
                                VALUES (
                                    ${project.id}, 
                                    ${project.ownerId || user.id}, 
                                    ${projectJson}::jsonb, 
                                    ${Date.now()}, 
                                    ${project.createdAt || Date.now()}
                                )
                                ON CONFLICT (id) 
                                DO UPDATE SET 
                                    data = ${projectJson}::jsonb,
                                    updated_at = ${Date.now()};
                            `;
                        } catch (retryErr) {
                             if (isDbConnectionError(retryErr)) return res.status(503).json({error: "DB Offline"});
                             throw retryErr;
                        }
                    } else {
                        throw dbError;
                    }
                }
            }
        }
        return res.status(200).json({ success: true });
      }

      return res.status(405).send("Method not allowed");

  } catch (globalError) {
      if (isDbConnectionError(globalError)) {
          return res.status(503).json({ error: "Critical: Database Disconnected" });
      }
      console.error("Critical API Error:", globalError);
      return res.status(500).json({ error: "Critical Server Error", details: globalError.message });
  }
}
