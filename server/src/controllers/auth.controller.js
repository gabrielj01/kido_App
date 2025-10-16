import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

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

// Generate a JWT token from user
const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

// Serialize user to avoid exposing password, etc.
function serializeUser(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    phone: u.phone,
    address: u.address,
    latitude: u.latitude,
    longitude: u.longitude,
    hourlyRate: u.hourlyRate,
    workRadiusKm: u.workRadiusKm,     // ✅ NEW
    certifications: u.certifications,
    experience: u.experience,
    age: u.age,
    bio: u.bio,
    photoUrl: u.photoUrl,
    availability: u.availability,     // ✅ NEW
    ratingAvg: u.ratingAvg,
    ratingCount: u.ratingCount,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

// SIGNUP (POST /api/auth/signup)
export const signup = async (req, res, next) => {
  try {
    const {
      name,
      email,
      username,
      password,
      role,
      phone,
      address,
      latitude,
      longitude,
      hourlyRate,
      workRadiusKm,     // ✅ NEW
      certifications,
      experience,
      age,
      bio,
      photoUrl,
      availability,     // ✅ NEW (may be array of { day, hours })
    } = req.body || {};

    // Basic required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    }
    // Minimal password rule for MVP
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ field: 'password', error: 'too_short' });
    }

    // Phone required
    if (!phone) {
      return res.status(400).json({ field: 'phone', error: 'required' });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const usernameNorm = username ? String(username).trim().toLowerCase() : undefined;

    const phoneE164 = toE164IL(phone);
    if (!isValidILPhone(phoneE164)) {
      return res.status(400).json({ field: 'phone', error: 'invalid_format' });
    }

    // Uniqueness checks
    const emailTaken = await User.exists({ email: emailNorm });
    if (emailTaken) return res.status(409).json({ field: 'email', error: 'already_exists' });

    if (usernameNorm) {
      const userTaken = await User.exists({ username: usernameNorm });
      if (userTaken) return res.status(409).json({ field: 'username', error: 'already_exists' });
    }

    const phoneTaken = await User.exists({ phone: phoneE164 });
    if (phoneTaken) return res.status(409).json({ field: 'phone', error: 'already_exists' });

    // Normalize availability into an array of { day, hours[] }
    const normalizedAvailability = Array.isArray(availability)
      ? availability.map((a) => ({
          day: a?.day,
          hours: Array.isArray(a?.hours) ? a.hours : (a?.hours ? [a.hours] : []),
        }))
      : [];

    const user = await User.create({
      name,
      email: emailNorm,
      username: usernameNorm,
      password,
      role,
      phone: phoneE164,
      address,
      latitude,
      longitude,
      hourlyRate,
      workRadiusKm: Number.isFinite(Number(workRadiusKm)) ? Number(workRadiusKm) : undefined, // ✅ NEW
      certifications,
      experience,
      age,
      bio,
      photoUrl,
      availability: normalizedAvailability, // ✅ NEW
    });

    const token = generateToken(user);
    return res
      .status(201)
      .json({ token, user: serializeUser(user), message: 'Account created successfully' });
  } catch (err) {
    // Duplicate key handling
    if (err?.code === 11000) {
      if (err?.keyPattern?.email)   return res.status(409).json({ field: 'email', error: 'already_exists' });
      if (err?.keyPattern?.username) return res.status(409).json({ field: 'username', error: 'already_exists' });
      if (err?.keyPattern?.phone)   return res.status(409).json({ field: 'phone', error: 'already_exists' });
    }
    return next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Availability check (email/username/phone)
export async function checkAvailability(req, res) {
  try {
    const rawEmail = (req.query.email || req.query.value || '').toString().trim().toLowerCase();
    const rawUsername = (req.query.username || req.query.value || '').toString().trim().toLowerCase();
    const rawPhone = (req.query.phone || '').toString().trim();

    const result = {
      email: { query: rawEmail || null, available: true },
      username: { query: rawUsername || null, available: true },
      phone: { query: rawPhone || null, available: true, valid: null, normalized: null },
    };

    if (rawEmail) {
      const existsEmail = await User.exists({ email: rawEmail });
      result.email.available = !existsEmail;
    }

    if (rawUsername) {
      const existsUsername = await User.exists({ username: rawUsername });
      result.username.available = !existsUsername;
    }

    if (rawPhone) {
      const normalized = toE164IL(rawPhone);
      const valid = isValidILPhone(normalized);
      result.phone.valid = valid;
      result.phone.normalized = valid ? normalized : null;
      if (valid) {
        const existsPhone = await User.exists({ phone: normalized });
        result.phone.available = !existsPhone;
      } else {
        result.phone.available = false;
      }
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Availability check failed', details: err.message });
  }
}
