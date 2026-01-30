
import { handleUpload } from '@vercel/blob';
import { verifyUser, getClerkClient } from './_auth.js';
import { sql } from '@vercel/postgres';

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
        // 1. Auth Check using Clerk
        const user = await verifyUser(req);
        if (!user) {
             throw new Error("Unauthorized: Invalid Token");
        }

        // 2. Parse Payload
        const { projectId } = JSON.parse(clientPayload || '{}');
        if (!projectId) {
            throw new Error("Forbidden: Project ID required");
        }

        // 3. Verify Project Access in DB
        // User must be owner OR member of the organization
        try {
            const { rows } = await sql`SELECT owner_id, org_id FROM projects WHERE id = ${projectId}`;
            
            if (rows.length === 0) {
                throw new Error("Project not found");
            }
            
            const project = rows[0];
            let hasAccess = false;

            // Check A: Owner
            if (project.owner_id === user.userId) {
                hasAccess = true;
            } 
            // Check B: Org Member
            else if (project.org_id) {
                const clerk = getClerkClient();
                const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.userId });
                const userOrgs = memberships.data.map(m => m.organization.id);
                
                if (userOrgs.includes(project.org_id)) {
                    hasAccess = true;
                }
            }

            if (!hasAccess) {
                throw new Error("Forbidden: You do not have permission to upload files to this project.");
            }

        } catch (dbError) {
            console.error("Upload Auth Error:", dbError);
            throw new Error("Authorization verification failed");
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
        // Optional: Log upload success
        console.log(`Blob uploaded: ${blob.url}`);
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    const status = error.message.includes('Forbidden') ? 403 : 400;
    return res.status(status).json({ error: error.message });
  }
}
