
export default async function handler(req, res) {
  // Guest login is permanently disabled in favor of Clerk Authentication.
  return res.status(410).json({ error: "Guest login is disabled. Please sign in with Google or Email." });
}
