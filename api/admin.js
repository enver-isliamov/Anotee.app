
import { sql } from '@vercel/postgres';
import { verifyUser } from './_auth.js';

export default async function handler(req, res) {
    const { action } = req.query;

    // --- 1. SETUP DATABASE ---
    if (action === 'setup') {
        const providedSecret = req.query.secret;
        const expectedSecret = process.env.CLERK_SECRET_KEY;

        if (!expectedSecret || providedSecret !== expectedSecret) {
            return res.status(403).json({ error: "Forbidden" });
        }

        try {
            await sql`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT);`;
            await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id TEXT;`;
            await sql`CREATE INDEX IF NOT EXISTS idx_owner_id ON projects (owner_id);`;
            await sql`CREATE INDEX IF NOT EXISTS idx_org_id ON projects (org_id);`;
            return res.status(200).json({ success: true, message: "DB Setup Complete" });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // --- 2. MIGRATE DATA ---
    if (action === 'migrate') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        try {
            const user = await verifyUser(req);
            if (!user) return res.status(401).json({ error: "Unauthorized" });

            // Ensure Schema
            await sql`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT);`;
            await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id TEXT;`;

            const BATCH_SIZE = 50;
            let offset = 0;
            let updatedCount = 0;
            let claimedCount = 0;
            let hasMore = true;

            while (hasMore) {
                const { rows } = await sql`SELECT id, owner_id, data FROM projects ORDER BY created_at DESC LIMIT ${BATCH_SIZE} OFFSET ${offset};`;
                if (rows.length === 0) { hasMore = false; break; }

                for (const row of rows) {
                    let project = row.data;
                    let currentOwnerId = row.owner_id;
                    
                    if (currentOwnerId === user.email && user.email) {
                        currentOwnerId = user.id;
                        project.ownerId = user.id;
                        claimedCount++;
                    }

                    if (project.team && Array.isArray(project.team)) {
                        project.team = project.team.map(member => {
                            if ((member.id === user.email) || (member.email === user.email)) {
                                return { ...member, id: user.id, avatar: user.avatar || member.avatar };
                            }
                            return member;
                        });
                    }

                    try {
                        await sql`UPDATE projects SET owner_id = ${currentOwnerId}, data = ${JSON.stringify(project)}::jsonb, org_id = ${project.orgId || null}, updated_at = ${Date.now()} WHERE id = ${project.id};`;
                        updatedCount++;
                    } catch (e) { console.error(e); }
                }
                offset += BATCH_SIZE;
                if (offset > 5000) hasMore = false; 
            }

            return res.status(200).json({ success: true, updatedProjects: updatedCount, claimedOwnerships: claimedCount });
        } catch (error) {
            return res.status(500).json({ error: "Internal Server Error", details: error.message });
        }
    }

    return res.status(400).json({ error: 'Invalid action' });
}
