
import { sql } from '@vercel/postgres';
import { verifyUser } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Authenticate Request
    const user = await verifyUser(req);
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`🚀 Starting Migration for User: ${user.email} (${user.id})`);

    // 2. SELF-HEALING: Ensure Schema Exists
    try {
        await sql`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT);`;
        await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id TEXT;`;
        await sql`CREATE INDEX IF NOT EXISTS idx_org_id ON projects (org_id);`;
    } catch (schemaError) {
        console.error("Schema repair failed:", schemaError);
    }

    // 3. Batch Processing
    const BATCH_SIZE = 50;
    let offset = 0;
    let updatedCount = 0;
    let claimedCount = 0;
    let hasMore = true;

    while (hasMore) {
        const { rows } = await sql`SELECT id, data FROM projects ORDER BY created_at DESC LIMIT ${BATCH_SIZE} OFFSET ${offset};`;
        
        if (rows.length === 0) {
            hasMore = false;
            break;
        }

        for (const row of rows) {
            let project = row.data;
            let needsUpdate = false;

            // A. Claim Legacy Projects
            if (project.team && Array.isArray(project.team)) {
                const memberIndex = project.team.findIndex(m => m.email === user.email || m.name === user.name); 
                
                if (memberIndex !== -1) {
                    const member = project.team[memberIndex];
                    if (member.id !== user.id) {
                        project.team[memberIndex].id = user.id; 
                        project.team[memberIndex].avatar = user.avatar; 
                        needsUpdate = true;
                        claimedCount++;
                    }
                }
            }

            // B. Ensure Owner ID consistency (Optional logic here)

            // C. Save to DB (Update JSON + Columns)
            // Always run update to ensure org_id column is populated/synced
            const jsonOrgId = project.orgId || null;
            
            try {
                // Determine if we actually need to write to DB to save IOPS
                // We write if:
                // 1. The JSON changed (needsUpdate)
                // 2. The column org_id doesn't match the json org_id (migration logic)
                // Since we can't easily check col value without selecting it (which we did implicitly via `select *` in previous versions, but here `select id, data`), 
                // we assume we want to enforce consistency.
                
                await sql`
                    UPDATE projects 
                    SET data = ${JSON.stringify(project)}::jsonb, 
                        org_id = ${jsonOrgId},
                        updated_at = ${Date.now()}
                    WHERE id = ${project.id};
                `;
                updatedCount++;
            } catch (updateErr) {
                console.error(`Failed to update project ${project.id}`, updateErr);
            }
        }

        offset += BATCH_SIZE;
        // Safety break for extremely large DBs in serverless function timeout
        if (offset > 5000) {
            console.warn("Migration limit reached (5000 records). Run again to continue.");
            hasMore = false; 
        }
    }

    console.log(`✅ Migration complete. Updated ${updatedCount} projects.`);

    return res.status(200).json({ 
        success: true, 
        updatedProjects: updatedCount,
        claimedMemberships: claimedCount,
        message: `Migration successful. Scanned and optimized ${updatedCount} projects.`
    });

  } catch (error) {
    console.error("Migration Fatal Error:", error);
    return res.status(500).json({ 
        error: "Internal Server Error", 
        details: error.message 
    });
  }
}
