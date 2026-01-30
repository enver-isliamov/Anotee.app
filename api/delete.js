
import { del } from '@vercel/blob';
import { verifyUser, getClerkClient } from './_auth.js';
import { sql } from '@vercel/postgres';

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

  if (!user.isVerified) {
      return res.status(403).json({ error: "Guests cannot delete files" });
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
        SELECT owner_id, org_id FROM projects WHERE id = ${projectId}
    `;

    if (rows.length === 0) {
        return res.status(404).json({ error: "Project not found" });
    }

    const project = rows[0];
    let canDelete = false;

    // A. Direct Ownership
    if (project.owner_id === user.id) {
        canDelete = true;
    } 
    // B. Organization Admin (Allow admins to clean up)
    else if (project.org_id) {
        try {
            const clerk = getClerkClient();
            const memberships = await clerk.users.getOrganizationMembershipList({ 
                userId: user.userId, 
                limit: 100 
            });
            
            const targetOrg = memberships.data.find(m => m.organization.id === project.org_id);
            if (targetOrg && targetOrg.role === 'org:admin') {
                canDelete = true;
                console.log(`Org Admin ${user.id} deleting project for ${project.owner_id}`);
            }
        } catch (e) {
            console.error("Failed to verify org permissions during delete", e);
        }
    }

    if (!canDelete) {
        return res.status(403).json({ error: "Forbidden: You must be the owner or an organization admin." });
    }
    
    console.log(`User ${user.id} deleting blobs for project ${projectId}:`, urls);
    await del(urls);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({ error: error.message });
  }
}
