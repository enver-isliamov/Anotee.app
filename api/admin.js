
import { sql } from '@vercel/postgres';
import { verifyUser, getClerkClient } from './_auth.js';

export default async function handler(req, res) {
    const { action } = req.query;

    // --- PUBLIC / HYBRID ENDPOINTS ---

    // 1. Get Payment Config
    if (action === 'get_payment_config') {
        try {
            const user = await verifyUser(req); 
            let isAdmin = false;
            if (user && user.userId) {
                try {
                    const clerk = getClerkClient();
                    const clerkUser = await clerk.users.getUser(user.userId);
                    const role = clerkUser.publicMetadata?.role;
                    isAdmin = role === 'admin' || role === 'superadmin';
                } catch (e) {
                    console.warn("Failed to verify admin status", e);
                }
            }

            await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'payment_config'`;
            const rawConfig = rows.length > 0 ? rows[0].value : {};

            if (isAdmin) {
                return res.status(200).json(rawConfig);
            } else {
                const safeConfig = {
                    ...rawConfig,
                    yookassa: { shopId: rawConfig.yookassa?.shopId },
                    prodamus: { url: rawConfig.prodamus?.url }
                };
                return res.status(200).json(safeConfig);
            }
        } catch (e) {
            console.error("Payment Config Error:", e);
            return res.status(200).json({});
        }
    }

    // 2. Get App Config
    if (action === 'get_config') {
        try {
            await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'feature_flags'`;
            return res.status(200).json(rows.length > 0 ? rows[0].value : {});
        } catch (e) {
            return res.status(200).json({}); 
        }
    }

    // 3. Get App Version
    if (action === 'get_version') {
        try {
            await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'app_version'`;
            return res.status(200).json(rows.length > 0 ? rows[0].value : null);
        } catch (e) {
            return res.status(200).json(null);
        }
    }

    // --- STRICT ADMIN ACTIONS ---
    try {
        const user = await verifyUser(req); 
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const clerk = getClerkClient();
        const clerkUser = await clerk.users.getUser(user.userId);
        const role = clerkUser.publicMetadata?.role;
        const isSuperAdmin = role === 'admin' || role === 'superadmin';

        if (!isSuperAdmin) {
            return res.status(403).json({ error: "Forbidden: Admins only" });
        }

        // --- SETUP DATABASE ---
        if (action === 'setup') {
            const providedSecret = req.query.secret;
            const expectedSecret = process.env.CLERK_SECRET_KEY;
            if (!expectedSecret || providedSecret !== expectedSecret) return res.status(403).json({ error: "Forbidden" });

            try {
                await sql`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT);`;
                await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id TEXT;`;
                await sql`CREATE INDEX IF NOT EXISTS idx_owner_id ON projects (owner_id);`;
                await sql`CREATE INDEX IF NOT EXISTS idx_org_id ON projects (org_id);`;
                await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
                return res.status(200).json({ success: true, message: "DB Setup Complete" });
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        }

        // --- MIGRATE DATA ---
        if (action === 'migrate') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
                    try {
                        await sql`UPDATE projects SET owner_id = ${currentOwnerId}, data = ${JSON.stringify(project)}::jsonb, org_id = ${project.orgId || null}, updated_at = ${Date.now()} WHERE id = ${project.id};`;
                        updatedCount++;
                    } catch (e) { console.error(e); }
                }
                offset += BATCH_SIZE;
                if (offset > 5000) hasMore = false; 
            }
            return res.status(200).json({ success: true, updatedProjects: updatedCount, claimedOwnerships: claimedCount });
        }

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
                    lastActive: u.lastSignInAt,
                    isAdmin: meta.role === 'admin' || meta.role === 'superadmin'
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
                expiresAt = days === 0 ? new Date('2099-12-31').getTime() : Date.now() + (days * 24 * 60 * 60 * 1000);
            } else {
                expiresAt = new Date('2099-12-31').getTime();
            }

            // Safe Merge
            const targetUser = await clerk.users.getUser(userId);
            const currentMeta = targetUser.publicMetadata || {};

            await clerk.users.updateUser(userId, {
                publicMetadata: {
                    ...currentMeta,
                    plan: 'pro',
                    status: 'active',
                    expiresAt: expiresAt,
                    yookassaPaymentMethodId: null
                }
            });
            return res.status(200).json({ success: true, message: `Pro granted to ${userId}` });
        }

        // --- REVOKE PRO ---
        if (action === 'revoke_pro') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const { userId } = req.body;
            
            // Safe Merge
            const targetUser = await clerk.users.getUser(userId);
            const currentMeta = targetUser.publicMetadata || {};

            await clerk.users.updateUser(userId, {
                publicMetadata: {
                    ...currentMeta,
                    plan: 'free',
                    status: 'inactive',
                    expiresAt: null
                }
            });
            return res.status(200).json({ success: true });
        }

        // --- TOGGLE ADMIN ROLE ---
        if (action === 'toggle_admin') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const { userId, makeAdmin } = req.body;
            if (userId === user.userId) return res.status(400).json({ error: "Cannot change own admin status" });

            // Safe Merge
            const targetUser = await clerk.users.getUser(userId);
            const currentMeta = targetUser.publicMetadata || {};

            await clerk.users.updateUser(userId, {
                publicMetadata: {
                    ...currentMeta,
                    role: makeAdmin ? 'admin' : 'user'
                }
            });
            return res.status(200).json({ success: true });
        }

        // --- UPDATE CONFIGS ---
        if (action === 'update_config') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            await sql`INSERT INTO system_settings (key, value) VALUES ('feature_flags', ${JSON.stringify(req.body)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(req.body)}::jsonb;`;
            return res.status(200).json({ success: true });
        }

        if (action === 'update_payment_config') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            await sql`INSERT INTO system_settings (key, value) VALUES ('payment_config', ${JSON.stringify(req.body)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(req.body)}::jsonb;`;
            return res.status(200).json({ success: true });
        }

        if (action === 'update_version') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            await sql`INSERT INTO system_settings (key, value) VALUES ('app_version', ${JSON.stringify(req.body)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(req.body)}::jsonb;`;
            return res.status(200).json({ success: true });
        }

    } catch (error) {
        console.error("Admin API Error:", error);
        return res.status(500).json({ error: error.message });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
