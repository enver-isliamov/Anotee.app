
import { sql } from '@vercel/postgres';
import { verifyUser, getClerkClient } from './_auth.js';

// 🛑 UPDATE: Added your yandex email here
const ADMIN_EMAILS = ['enverphoto@gmail.com', 'enver.isliamov@yandex.com'];

export default async function handler(req, res) {
    const { action } = req.query;

    // --- PUBLIC/AUTH ALLOWED ACTIONS (Before Admin Check) ---
    
    // 1. Get Config (Available to any logged in user to know their limits)
    if (action === 'get_config') {
        try {
            const user = await verifyUser(req); 
            // Optional: if (!user) return defaults... but frontend handles auth
            
            // Create table if not exists just in case
            await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
            
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'feature_flags'`;
            return res.status(200).json(rows.length > 0 ? rows[0].value : {});
        } catch (e) {
            console.error(e);
            return res.status(200).json({}); 
        }
    }

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
            
            // NEW: System Settings Table for Feature Flags
            await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
            
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

    // --- 3. STRICT ADMIN ACTIONS (Middleware Check) ---
    try {
        const user = await verifyUser(req, true); // Force email fetch
        if (!user || !user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase().trim())) {
            return res.status(403).json({ error: "Forbidden: Admins only" });
        }

        const clerk = getClerkClient();

        // --- LIST USERS ---
        if (action === 'users') {
            if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
            
            const usersList = await clerk.users.getUserList({ limit: 100, orderBy: '-created_at' });
            const data = usersList.data.map(u => {
                const meta = u.publicMetadata || {};
                const email = u.emailAddresses.find(e => e.id === u.primaryEmailAddressId)?.emailAddress || 'No Email';
                return {
                    id: u.id,
                    name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                    email: email,
                    avatar: u.imageUrl,
                    plan: meta.plan || 'free',
                    expiresAt: meta.expiresAt,
                    isAutoRenew: !!meta.yookassaPaymentMethodId,
                    lastActive: u.lastSignInAt
                };
            });
            return res.status(200).json({ users: data });
        }

        // --- GRANT PRO ---
        if (action === 'grant_pro') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            
            const { userId, days } = req.body;
            if (!userId) return res.status(400).json({ error: "Missing userId" });

            let expiresAt = null;
            if (days && typeof days === 'number') {
                // If days > 0, calculate date. If 0, assumes lifetime (handled by frontend logic usually, but here just in case)
                expiresAt = days === 0 ? new Date('2099-12-31').getTime() : Date.now() + (days * 24 * 60 * 60 * 1000);
            } else {
                expiresAt = new Date('2099-12-31').getTime();
            }

            await clerk.users.updateUserMetadata(userId, {
                publicMetadata: {
                    plan: 'pro',
                    status: 'active',
                    expiresAt: expiresAt,
                    yookassaPaymentMethodId: null // Manual grant usually doesn't have a card attached
                }
            });

            return res.status(200).json({ success: true, message: `Pro granted to ${userId}` });
        }

        // --- REVOKE PRO ---
        if (action === 'revoke_pro') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const { userId } = req.body;
            
            await clerk.users.updateUserMetadata(userId, {
                publicMetadata: {
                    plan: 'free',
                    status: 'inactive',
                    expiresAt: null
                }
            });
            return res.status(200).json({ success: true });
        }

        // --- UPDATE FEATURE FLAGS ---
        if (action === 'update_config') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const config = req.body;
            
            await sql`
                INSERT INTO system_settings (key, value) 
                VALUES ('feature_flags', ${JSON.stringify(config)}::jsonb)
                ON CONFLICT (key) 
                DO UPDATE SET value = ${JSON.stringify(config)}::jsonb;
            `;
            return res.status(200).json({ success: true });
        }

        // --- GET PAYMENT CONFIG ---
        if (action === 'get_payment_config') {
            if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
            
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'payment_config'`;
            // Return empty object if not set, UI handles defaults
            return res.status(200).json(rows.length > 0 ? rows[0].value : {});
        }

        // --- UPDATE PAYMENT CONFIG ---
        if (action === 'update_payment_config') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const config = req.body;
            
            // Validate minimal structure
            if (!config || !['yookassa', 'prodamus'].includes(config.activeProvider)) {
                return res.status(400).json({ error: "Invalid payment config" });
            }

            await sql`
                INSERT INTO system_settings (key, value) 
                VALUES ('payment_config', ${JSON.stringify(config)}::jsonb)
                ON CONFLICT (key) 
                DO UPDATE SET value = ${JSON.stringify(config)}::jsonb;
            `;
            return res.status(200).json({ success: true });
        }

    } catch (error) {
        console.error("Admin API Error:", error);
        return res.status(500).json({ error: error.message });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
