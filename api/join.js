
export default async function handler(req, res) {
  // Deprecated endpoint. Join logic is now handled by Clerk Organizations.
  // Guests cannot join via link anymore in the Organization model, 
  // they should be invited via Clerk email invite or access public links.
  return res.status(410).json({ error: "This endpoint is deprecated. Please use Clerk Organizations." });
}
