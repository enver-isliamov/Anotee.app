
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
    }

    const { guestId, googleToken } = body || {};

    if (!guestId || !googleToken) {
        return res.status(400).json({ error: "Missing guestId or googleToken" });
    }

    // 1. Verify Google Token
    let googleUser;
    try {
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${googleToken}`);
        if (!response.ok) throw new Error("Invalid Token");
        const payload = await response.json();
        googleUser = {
            id: payload.email,
            email: payload.email,
            name: payload.name,
            avatar: payload.picture,
            role: 'Admin' // Upgraded role
        };
    } catch (e) {
        return res.status(401).json({ error: "Invalid Google Credential" });
    }

    if (googleUser.id === guestId) {
        return res.status(200).json({ success: true, message: "Already same user" });
    }

    console.log(`🚀 Migrating Guest [${guestId}] to Google User [${googleUser.id}]`);

    // 2. Fetch ALL projects (To find where guest is involved)
    // In a massive production app, we would query differently, but for V1 filtering in JS is safer/easier than complex JSONB queries.
    const { rows } = await sql`SELECT id, data FROM projects;`;
    
    let updatedCount = 0;

    for (const row of rows) {
        let project = row.data;
        let needsUpdate = false;

        // A. Migrate Team Membership
        if (project.team && Array.isArray(project.team)) {
            const guestIndex = project.team.findIndex(m => m.id === guestId);
            if (guestIndex !== -1) {
                // Check if Google user is ALREADY in the team to avoid duplicates
                const existingGoogleIndex = project.team.findIndex(m => m.id === googleUser.id);
                
                if (existingGoogleIndex !== -1) {
                    // Remove guest, Google user remains
                    project.team.splice(guestIndex, 1);
                } else {
                    // Replace guest with Google user
                    project.team[guestIndex] = {
                        ...googleUser,
                        role: 'Creator' // Or Admin, depending on logic. Let's start with Creator (Collaborator)
                    };
                }
                needsUpdate = true;
            }
        }

        // B. Migrate Comments Ownership
        if (project.assets && Array.isArray(project.assets)) {
            project.assets.forEach(asset => {
                if (asset.versions && Array.isArray(asset.versions)) {
                    asset.versions.forEach(version => {
                        if (version.comments && Array.isArray(version.comments)) {
                            version.comments.forEach(comment => {
                                if (comment.userId === guestId) {
                                    comment.userId = googleUser.id;
                                    comment.authorName = googleUser.name; // Update display name
                                    needsUpdate = true;
                                }
                            });
                        }
                    });
                }
            });
        }

        // C. Save if changed
        if (needsUpdate) {
            await sql`
                UPDATE projects 
                SET data = ${JSON.stringify(project)}::jsonb, 
                    updated_at = ${Date.now()}
                WHERE id = ${project.id};
            `;
            updatedCount++;
        }
    }

    console.log(`✅ Migration complete. Updated ${updatedCount} projects.`);

    return res.status(200).json({ 
        success: true, 
        user: googleUser,
        updatedProjects: updatedCount 
    });

  } catch (error) {
    console.error("Migration error:", error);
    return res.status(500).json({ error: error.message });
  }
}
