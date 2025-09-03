// server/src/controllers/validationController.js
import { User } from "../models/User.js";

// GET /api/validate/email?email=... OR ?value=...
export async function checkEmailAvailability(req, res) {
  try {
    const raw = (req.query.email || req.query.value || "").toString().trim().toLowerCase();
    if (!raw) return res.status(400).json({ error: "Missing email" });
    const exists = await User.exists({ email: raw });
    return res.json({ email: raw, available: !exists });
  } catch (err) {
    return res.status(500).json({ error: "Failed to validate email", details: err.message });
  }
}

// GET /api/validate/username?username=... OR ?value=...
export async function checkUsernameAvailability(req, res) {
  try {
    const raw = (req.query.username || req.query.value || "").toString().trim();
    if (!raw) return res.status(400).json({ error: "Missing username" });
    const exists = await User.exists({ username: raw });
    return res.json({ username: raw, available: !exists });
  } catch (err) {
    return res.status(500).json({ error: "Failed to validate username", details: err.message });
  }
}
