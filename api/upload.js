
import { handleUpload } from '@vercel/blob/client';
import { verifyUser } from './_auth.js';

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

        // 2. Allow Upload
        return {
          allowedContentTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'],
          tokenPayload: JSON.stringify({
             user: user.id
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Optional: Log upload success
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
