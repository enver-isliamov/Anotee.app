
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

    // 2. Fetch ALL projects to scan for legacy data
    // In V1 this is acceptable. For V2 we'd use WHERE clauses, but legacy data is unstructured.
    const { rows } = await sql`SELECT id, data FROM projects;`;
    
    let updatedCount = 0;
    let claimedCount = 0;

    for (const row of rows) {
        let project = row.data;
        let needsUpdate = false;

        // A. Backfill org_id column (Optimization)
        // If the JSON has orgId but the DB column is likely empty (handled by query update later), 
        // we prepare the data.
        // Actually, we just ensure the JSON is consistent.
        
        // B. Claim Legacy Projects (Fix User IDs)
        // If the user's email exists in the team but the ID is different (legacy ID), update it.
        if (project.team && Array.isArray(project.team)) {
            const memberIndex = project.team.findIndex(m => m.email === user.email || m.name === user.name); // Email match is safer
            
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

        // C. Update Comments ownership
        if (project.assets) {
            project.assets.forEach(asset => {
                asset.versions.forEach(version => {
                    if (version.comments) {
                        version.comments.forEach(comment => {
                            // If we knew the old ID, we'd replace it. 
                            // Since we don't strictly know it without mapping, we skip blindly replacing comments
                            // unless we matched the team member above.
                            // For V1, we will skip comment migration to avoid theft, 
                            // assuming key users are Owners/Team members first.
                        });
                    }
                });
            });
        }

        // D. Save to DB (Update JSON + Columns)
        if (needsUpdate || project.orgId) {
            // Even if no team change, we might want to backfill org_id column if it exists in JSON
            const orgId = project.orgId || null;
            
            await sql`
                UPDATE projects 
                SET data = ${JSON.stringify(project)}::jsonb, 
                    org_id = ${orgId},
                    updated_at = ${Date.now()}
                WHERE id = ${project.id};
            `;
            updatedCount++;
        }
    }

    console.log(`✅ Migration complete. Updated ${updatedCount} projects. Claimed ${claimedCount} memberships.`);

    return res.status(200).json({ 
        success: true, 
        updatedProjects: updatedCount,
        claimedMemberships: claimedCount,
        message: `Migration successful. Optimized ${updatedCount} projects.`
    });

  } catch (error) {
    console.error("Migration error:", error);
    return res.status(500).json({ error: error.message });
  }
}
