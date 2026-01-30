
// DEPRECATED: Guest access is no longer supported. Use Clerk Auth.
export default function handler(req, res) {
  res.status(410).json({ error: "Gone. Guest mode disabled." });
}
