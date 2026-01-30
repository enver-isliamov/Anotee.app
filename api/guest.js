
export default function handler(req, res) {
  return res.status(410).json({ error: "Gone. Guest accounts are no longer supported." });
}
