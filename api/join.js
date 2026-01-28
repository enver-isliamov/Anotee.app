
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

    const { projectId, user } = body || {};

    if (!projectId || !user || !user.id) {
        return res.status(400).json({ error: "Missing required fields (projectId, user)" });
    }

    // 1. Fetch current project data
    let rows = [];
    try {
        const result = await sql`SELECT data FROM projects WHERE id = ${projectId};`;
        rows = result.rows;
    } catch (dbError) {
        // Handle specific Neon DB 404 (Database deleted/paused)
        if (dbError.message && dbError.message.includes('HTTP status 404')) {
            console.error("Join failed: DB 404");
            return res.status(503).json({ error: "Project hosting is currently offline (Database Disconnected)." });
        }

        // If table doesn't exist, the project definitely doesn't exist.
        if (dbError.code === '42P01') {
            console.warn("Join failed: DB Table missing.");
            return res.status(404).json({ error: "Project not found (System not initialized)" });
        }
        throw dbError;
    }

    if (rows.length === 0) {
        console.warn(`Join failed: Project ${projectId} not found in DB.`);
        return res.status(404).json({ error: "Project not found. The owner may not have synced changes yet." });
    }

    let projectData = rows[0].data;

    if (!Array.isArray(projectData.team)) {
        projectData.team = [];
    }

    const existingMemberIndex = projectData.team.findIndex(m => m.id === user.id);

    if (existingMemberIndex === -1) {
        projectData.team.push(user);
        projectData.updatedAt = 'Just now';

        await sql`
            UPDATE projects 
            SET data = ${JSON.stringify(projectData)}::jsonb,
                updated_at = ${Date.now()}
            WHERE id = ${projectId};
        `;
        
        console.log(`✅ User ${user.name} (${user.id}) joined project ${projectId}`);
    }

    return res.status(200).json({ success: true, project: projectData });

  } catch (error) {
    console.error("Join error:", error);
    return res.status(500).json({ error: error.message });
  }
}
