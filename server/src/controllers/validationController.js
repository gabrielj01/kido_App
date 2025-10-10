import User from '../models/User.js';

// --- Helpers: normalize & validate IL phone to E.164 (+972...)
const digitsOnly = (v = '') => String(v).replace(/[^\d+]/g, '');
const toE164IL = (v = '') => {
  const s = digitsOnly(v);
  if (!s) return '';
  if (s.startsWith('+972')) return s;
  const d = s.replace(/\D/g, '');
  if (d.startsWith('972')) return '+972' + d.slice(3);
  if (d.startsWith('0')) return '+972' + d.slice(1);
  return '';
};
const isValidILPhone = (v = '') => /^\+972(?:[2-9]\d{7}|5\d{8})$/.test(toE164IL(v));

// GET /api/validate/email?email=... OR ?value=...
export async function checkEmailAvailability(req, res) {
  try {
    const raw = (req.query.email || req.query.value || '').toString().trim().toLowerCase();
    if (!raw) return res.status(400).json({ error: 'Missing email' });
    const exists = await User.exists({ email: raw });
    return res.json({ email: raw, available: !exists });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to validate email', details: err.message });
  }
}

// GET /api/validate/username?username=... OR ?value=...
export async function checkUsernameAvailability(req, res) {
  try {
    const raw = (req.query.username || req.query.value || '').toString().trim().toLowerCase();
    if (!raw) return res.status(400).json({ error: 'Missing username' });
    const exists = await User.exists({ username: raw });
    return res.json({ username: raw, available: !exists });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to validate username', details: err.message });
  }
}

// GET /api/validate/phone?phone=... OR ?value=...
export async function checkPhoneAvailability(req, res) {
  try {
    const raw = (req.query.phone || req.query.value || '').toString().trim();
    if (!raw) return res.status(400).json({ error: 'Missing phone' });
    const normalized = toE164IL(raw);
    const valid = isValidILPhone(normalized);
    if (!valid) return res.json({ phone: raw, valid: false, normalized: '', available: false });

    const exists = await User.exists({ phone: normalized });
    return res.json({ phone: raw, valid: true, normalized, available: !exists });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to validate phone', details: err.message });
  }
}
