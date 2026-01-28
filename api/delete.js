
import { del } from '@vercel/blob';
import { verifyUser } from './_auth.js';

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

  // Extra check: Guests cannot delete blobs
  if (!user.isVerified) {
      return res.status(403).json({ error: "Guests cannot delete files" });
  }

  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "No URLs provided for deletion" });
    }
    
    console.log("Deleting blobs:", urls);
    await del(urls);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({ error: error.message });
  }
}
