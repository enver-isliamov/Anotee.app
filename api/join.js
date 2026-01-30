
export default function handler(req, res) {
  res.status(404).json({ error: "Endpoint deprecated. Please use Organization invites." });
}
