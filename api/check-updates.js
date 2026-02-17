
import { sql } from '@vercel/postgres';
import { verifyUser, getClerkClient } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).send("Method Not Allowed");

    try {
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const targetOrgId = req.query.orgId;

        // 1. Fetch Org Memberships to verify access
        let userOrgIds = [];
        if (user.isVerified && user.userId) {
            try {
                const clerk = getClerkClient();
                const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                userOrgIds = memberships.data.map(m => m.organization.id);
            } catch (e) {
                // non-critical if it fails, just won't show org projects
            }
        }

        let query;

        if (targetOrgId) {
            // Check specific Org updates
            if (!userOrgIds.includes(targetOrgId)) {
                return res.status(403).json({ error: "Forbidden" });
            }
            query = sql`SELECT MAX(updated_at) as last_modified FROM projects WHERE org_id = ${targetOrgId}`;
        } else {
            // Check Personal Workspace updates
            query = sql`
                SELECT MAX(updated_at) as last_modified 
                FROM projects 
                WHERE (org_id IS NULL OR org_id = '') 
                AND (
                    owner_id = ${user.id} 
                    OR 
                    data->'team' @> ${JSON.stringify([{id: user.id}])}::jsonb
                )
            `;
        }

        const { rows } = await query;
        const lastModified = rows[0]?.last_modified || 0;

        return res.status(200).json({ lastModified: Number(lastModified) });

    } catch (e) {
        console.error("Check Updates Error:", e);
        return res.status(500).json({ error: "Server Error" });
    }
}
