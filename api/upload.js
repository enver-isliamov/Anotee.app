
export default function handler(req, res) {
  res.status(410).json({ error: "Vercel Blob storage has been removed. Use Google Drive integration." });
}
