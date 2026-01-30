
export default function handler(req, res) {
  return res.status(410).json({ error: "Gone. Guest access and legacy join methods are deprecated." });
}
