
import { sql } from '@vercel/postgres';
import { verifyUser, getClerkClient } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
      const user = await verifyUser(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }

      const { projectId, assetId, versionId, action, payload } = body || {};

      if (!projectId || !assetId || !versionId || !action) {
          return res.status(400).json({ error: "Missing required fields" });
      }

      // 1. Fetch Project with Version
      let rows = [];
      try {
        const result = await sql`SELECT data, owner_id, org_id FROM projects WHERE id = ${projectId};`;
        rows = result.rows;
      } catch (e) {
         if (e.code === '42P01') return res.status(404).json({ error: "Project not found (DB empty)" });
         throw e;
      }

      if (rows.length === 0) return res.status(404).json({ error: "Project not found" });

      let projectData = rows[0].data;
      const ownerId = rows[0].owner_id;
      const orgId = rows[0].org_id;
      const currentVersion = projectData._version || 0; // Get current version for Optimistic Lock

      // 2. Security Check
      let hasAccess = false;
      
      // Check Owner
      if (ownerId === user.id) hasAccess = true;
      // Check Legacy Team Array
      else if (projectData.team && projectData.team.some(m => m.id === user.id)) hasAccess = true;
      // Check Organization
      else if (orgId) {
           try {
               const clerk = getClerkClient();
               const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
               const userOrgIds = memberships.data.map(m => m.organization.id);
               if (userOrgIds.includes(orgId)) hasAccess = true;
           } catch(e) {
               console.warn("Failed to check org membership for comment", e);
           }
      }

      if (!hasAccess) return res.status(403).json({ error: "Access denied" });

      // 3. Logic
      const asset = projectData.assets.find(a => a.id === assetId);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const version = asset.versions.find(v => v.id === versionId);
      if (!version) return res.status(404).json({ error: "Version not found" });
      if (!version.comments) version.comments = [];

      switch (action) {
          case 'create':
              version.comments.push({ ...payload, userId: user.id, createdAt: 'Just now' });
              break;
          case 'update':
              const uIdx = version.comments.findIndex(c => c.id === payload.id);
              if (uIdx !== -1) {
                  // Permission: Can only edit own comment unless Admin/Owner
                  const isCommentOwner = version.comments[uIdx].userId === user.id;
                  const isProjectOwner = ownerId === user.id;
                  
                  if (!isCommentOwner && !isProjectOwner) {
                       return res.status(403).json({ error: "Forbidden: Cannot edit others' comments" });
                  }

                  version.comments[uIdx] = { ...version.comments[uIdx], ...payload };
              }
              break;
          case 'delete':
              const dIdx = version.comments.findIndex(c => c.id === payload.id);
              if (dIdx !== -1) {
                  // Permission: Can only delete own comment unless Admin/Owner
                  const isCommentOwner = version.comments[dIdx].userId === user.id;
                  const isProjectOwner = ownerId === user.id;
                  
                  if (!isCommentOwner && !isProjectOwner) {
                      return res.status(403).json({ error: "Forbidden: Cannot delete others' comments" });
                  }
                  version.comments.splice(dIdx, 1);
              }
              break;
      }

      // Increment Version
      const newVersion = currentVersion + 1;
      projectData._version = newVersion;

      // 4. Save with Optimistic Locking
      const updateResult = await sql`
          UPDATE projects 
          SET data = ${JSON.stringify(projectData)}::jsonb, updated_at = ${Date.now()}
          WHERE id = ${projectId} 
          AND ((data->>'_version')::int = ${currentVersion} OR data->>'_version' IS NULL);
      `;

      if (updateResult.rowCount === 0) {
          return res.status(409).json({ error: "Conflict: Data modified by another user. Please refresh." });
      }

      return res.status(200).json({ success: true, _version: newVersion });

  } catch (error) {
    console.error("Comment API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
