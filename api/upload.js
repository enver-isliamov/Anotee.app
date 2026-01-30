
import { handleUpload } from '@vercel/blob';
import { sql } from '@vercel/postgres';
import { checkProjectAccess } from './_permissions.js';
import { getUserFromToken } from './_auth.js';

export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "Server configuration error: Missing Blob Token" });
  }

  const body = req.body;
  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // 1. Extract Payload
        let payload;
        try {
            payload = JSON.parse(clientPayload || '{}');
        } catch (e) {
            throw new Error("Invalid clientPayload");
        }

        const { token, projectId } = payload;
        
        if (!token) throw new Error("Unauthorized: Missing Token in Payload");
        if (!projectId) throw new Error("Forbidden: Project ID required");

        // 2. Verify Token using shared Auth Logic
        const user = await getUserFromToken(token);
        
        if (!user) {
            throw new Error("Unauthorized: Invalid Token");
        }

        // 3. Verify Project Access in DB
        try {
            const { rows } = await sql`SELECT owner_id, org_id, data FROM projects WHERE id = ${projectId}`;
            
            if (rows.length === 0) {
                throw new Error("Project not found");
            }
            
            const hasAccess = await checkProjectAccess(user, rows[0]);
            
            if (!hasAccess) {
                throw new Error("Forbidden: You do not have permission to upload files to this project.");
            }

        } catch (dbError) {
            console.error("Upload Auth Error:", dbError);
            throw new Error(dbError.message || "Authorization verification failed");
        }

        // 4. Allow Upload
        return {
          allowedContentTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'],
          maximumSizeInBytes: 450 * 1024 * 1024, // 450MB Limit
          tokenPayload: JSON.stringify({
             user: user.id,
             projectId: projectId
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log(`Blob uploaded: ${blob.url}`);
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    const status = error.message.includes('Forbidden') ? 403 : 400;
    return res.status(status).json({ error: error.message });
  }
}
