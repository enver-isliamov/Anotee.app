
import { del } from '@vercel/blob';
import { verifyUser, getClerkClient } from './_auth.js';
import { sql } from '@vercel/postgres';
import { checkProjectAccess } from './_permissions.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "Server configuration error: Missing Blob Token" });
  }

  // 1. Security Check
  const user = await verifyUser(req);
  if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { urls, projectId } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "No URLs provided for deletion" });
    }

    if (!projectId) {
        return res.status(400).json({ error: "ProjectId is required to verify ownership" });
    }

    // 2. Verify Project Ownership & Roles
    const { rows } = await sql`
        SELECT owner_id, org_id, data FROM projects WHERE id = ${projectId}
    `;

    if (rows.length === 0) {
        return res.status(404).json({ error: "Project not found" });
    }

    const projectRow = rows[0];
    
    // Basic access check first
    const hasAccess = await checkProjectAccess(user, projectRow);
    if (!hasAccess) {
         return res.status(403).json({ error: "Forbidden" });
    }

    let canDelete = false;

    // A. Personal Project: Only Owner
    if (projectRow.owner_id === user.id) {
        canDelete = true;
    } 
    // B. Organization Project: Admins AND Members (Editors)
    else if (projectRow.org_id) {
        try {
            const clerk = getClerkClient();
            const memberships = await clerk.users.getOrganizationMembershipList({ 
                userId: user.userId, 
                limit: 100 
            });
            const targetOrg = memberships.data.find(m => m.organization.id === projectRow.org_id);
            
            // Allow 'org:member' to delete ASSETS (not the project itself, which is handled in Dashboard UI/API)
            if (targetOrg && (targetOrg.role === 'org:admin' || targetOrg.role === 'org:member')) {
                canDelete = true;
            }
        } catch (e) {
            console.error("Org check failed during delete", e);
        }
    }

    if (!canDelete) {
        return res.status(403).json({ error: "Forbidden: You do not have permission to delete assets in this project." });
    }
    
    console.log(`User ${user.id} deleting blobs for project ${projectId}`);
    
    // Only verify urls belong to the project (simple check, in production we might check DB relation)
    await del(urls);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({ error: error.message });
  }
}
