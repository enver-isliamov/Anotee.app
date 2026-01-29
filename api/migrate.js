
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
    // This fixes the 500 error if the table or column doesn't exist yet.
    try {
        await sql`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT);`;
        await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id TEXT;`;
        await sql`CREATE INDEX IF NOT EXISTS idx_org_id ON projects (org_id);`;
    } catch (schemaError) {
        console.error("Schema repair failed:", schemaError);
        // Continue anyway, maybe it exists
    }

    // 3. Fetch ALL projects
    const { rows } = await sql`SELECT id, data FROM projects;`;
    
    if (rows.length === 0) {
        return res.status(200).json({ success: true, message: "Database is empty. Nothing to migrate.", updatedProjects: 0 });
    }

    let updatedCount = 0;
    let claimedCount = 0;

    for (const row of rows) {
        let project = row.data;
        let needsUpdate = false;

        // A. Claim Legacy Projects (Fix User IDs)
        // If the user's email exists in the team but the ID is different (legacy ID), update it.
        if (project.team && Array.isArray(project.team)) {
            const memberIndex = project.team.findIndex(m => m.email === user.email || m.name === user.name); 
            
            if (memberIndex !== -1) {
                const member = project.team[memberIndex];
                if (member.id !== user.id) {
                    console.log(`Found legacy membership in project ${project.id}. Updating ID.`);
                    project.team[memberIndex].id = user.id; // Swap legacy ID with Clerk ID
                    project.team[memberIndex].avatar = user.avatar; // Update avatar
                    needsUpdate = true;
                    claimedCount++;
                }
            }
        }

        // B. Ensure Owner ID is consistent
        // If I am the creator in the JSON data, but my ID changed
        if (project.ownerId && project.team.some(m => m.id === user.id && m.role === 'Admin')) {
             // Logic to claim ownership if previously unassigned or matched by name could go here
        }

        // C. Save to DB (Update JSON + Columns)
        // We update if we changed the JSON (needsUpdate) OR if we need to backfill the org_id column
        // Check if org_id in DB needs backfill from JSON
        const jsonOrgId = project.orgId || null;
        
        // Always run update to ensure org_id column is populated from JSON data
        try {
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

    console.log(`✅ Migration complete. Updated ${updatedCount} projects.`);

    return res.status(200).json({ 
        success: true, 
        updatedProjects: updatedCount,
        claimedMemberships: claimedCount,
        message: `Migration successful. Optimized ${updatedCount} projects.`
    });

  } catch (error) {
    console.error("Migration Fatal Error:", error);
    return res.status(500).json({ 
        error: "Internal Server Error", 
        details: error.message 
    });
  }
}
