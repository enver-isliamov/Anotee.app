
import { sql } from '@vercel/postgres';
import { verifyUser } from './_auth.js';

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

      // 1. Fetch Project
      let rows = [];
      try {
        const result = await sql`SELECT data, owner_id FROM projects WHERE id = ${projectId};`;
        rows = result.rows;
      } catch (e) {
         if (e.code === '42P01') return res.status(404).json({ error: "Project not found (DB empty)" });
         throw e;
      }

      if (rows.length === 0) return res.status(404).json({ error: "Project not found" });

      let projectData = rows[0].data;
      const ownerId = rows[0].owner_id;

      // 2. Security Check
      const isOwner = ownerId === user.id;
      const isInTeam = projectData.team && projectData.team.some(m => m.id === user.id);

      if (!isOwner && !isInTeam) return res.status(403).json({ error: "Access denied" });

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
                  if (version.comments[uIdx].userId !== user.id && !user.isVerified) return res.status(403).json({ error: "Forbidden" });
                  version.comments[uIdx] = { ...version.comments[uIdx], ...payload };
              }
              break;
          case 'delete':
              const dIdx = version.comments.findIndex(c => c.id === payload.id);
              if (dIdx !== -1) {
                  if (version.comments[dIdx].userId !== user.id && !user.isVerified) return res.status(403).json({ error: "Forbidden" });
                  version.comments.splice(dIdx, 1);
              }
              break;
      }

      // 4. Save
      await sql`
          UPDATE projects 
          SET data = ${JSON.stringify(projectData)}::jsonb, updated_at = ${Date.now()}
          WHERE id = ${projectId};
      `;

      return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Comment API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
