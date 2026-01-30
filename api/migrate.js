
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

    console.log(`🚀 Starting Migration for User: ${user.email} -> ${user.id} (Clerk ID)`);

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
        const { rows } = await sql`SELECT id, owner_id, data FROM projects ORDER BY created_at DESC LIMIT ${BATCH_SIZE} OFFSET ${offset};`;
        
        if (rows.length === 0) {
            hasMore = false;
            break;
        }

        for (const row of rows) {
            let project = row.data;
            let needsUpdate = false;
            let currentOwnerId = row.owner_id;

            // A. Claim Ownership (Migration from Email ID to Clerk ID)
            // If the project owner_id matches the user's email, update it to their new Clerk ID.
            if (currentOwnerId === user.email && user.email) {
                currentOwnerId = user.id; // Clerk ID
                project.ownerId = user.id; // Update JSON as well
                needsUpdate = true;
                claimedCount++;
            }

            // B. Fix Team Array (Legacy format)
            if (project.team && Array.isArray(project.team)) {
                project.team = project.team.map(member => {
                    // If member ID is an email (legacy) and matches current user email
                    if ((member.id === user.email) || (member.email === user.email)) {
                        needsUpdate = true;
                        return {
                            ...member,
                            id: user.id, // Migrate to Clerk ID
                            avatar: user.avatar || member.avatar
                        };
                    }
                    return member;
                });
            }

            // C. Save to DB (Update JSON + Columns)
            const jsonOrgId = project.orgId || null;
            
            // We update if we modified data OR if we need to sync the org_id column/owner_id column
            // for general consistency, even if JSON didn't change visibly (e.g. just column backfill)
            try {
                await sql`
                    UPDATE projects 
                    SET 
                        owner_id = ${currentOwnerId},
                        data = ${JSON.stringify(project)}::jsonb, 
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
        // Safety break for extremely large DBs
        if (offset > 5000) {
            console.warn("Migration limit reached. Run again.");
            hasMore = false; 
        }
    }

    console.log(`✅ Migration complete. Updated ${updatedCount} projects.`);

    return res.status(200).json({ 
        success: true, 
        updatedProjects: updatedCount,
        claimedOwnerships: claimedCount,
        message: `Migration successful. Converted ${claimedCount} legacy email-IDs to Clerk IDs.`
    });

  } catch (error) {
    console.error("Migration Fatal Error:", error);
    return res.status(500).json({ 
        error: "Internal Server Error", 
        details: error.message 
    });
  }
}
