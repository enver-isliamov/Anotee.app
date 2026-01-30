
// DEPRECATED: This API route has been removed in favor of Clerk Organization Invites.
export default function handler(req, res) {
  res.status(410).json({ error: "Gone. Use Organization Settings." });
}
