// server/src/controllers/auth.controller.js
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

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
    address: u.address,
    latitude: u.latitude,
    longitude: u.longitude,
    hourlyRate: u.hourlyRate,
    certifications: u.certifications,
    experience: u.experience,
    age: u.age,
    bio: u.bio,
    photoUrl: u.photoUrl,
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
      address,
      latitude,
      longitude,
      hourlyRate,
      certifications,
      experience,
      age,
      bio,
      photoUrl,
    } = req.body || {};

    // Basic required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const usernameNorm = username ? String(username).trim().toLowerCase() : undefined;

    // Check email uniqueness
    const emailTaken = await User.exists({ email: emailNorm });
    if (emailTaken) {
      return res.status(409).json({ field: 'email', error: 'already_exists' });
    }

    // Check username uniqueness (if provided)
    if (usernameNorm) {
      const userTaken = await User.exists({ username: usernameNorm });
      if (userTaken) {
        return res.status(409).json({ field: 'username', error: 'already_exists' });
      }
    }

    const availability = Array.isArray(req.body?.availability)
      ? req.body.availability.map(a => ({
          day: a.day,
          hours: Array.isArray(a.hours) ? a.hours : (a.hours ? [a.hours] : []),
        }))
      : [];

    const user = await User.create({
      name,
      email: emailNorm,
      username: usernameNorm,
      password,
      role,
      address,
      latitude,
      longitude,
      hourlyRate,
      certifications,
      experience,
      age,
      bio,
      photoUrl,
      availability,
    });

    const token = generateToken(user);
    return res.status(201).json({ token, user: serializeUser(user), message: 'Account created successfully' });
  } catch (err) {
    return next(err);
  }
};

// LOGIN unchanged (kept your logs)
export const login = async (req, res, next) => {
  try {
    console.log('🔥 login payload:', req.body);
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    console.log('🔥 user from DB:', user);

    console.log(
      '🔍 Compare passwords:',
      JSON.stringify(user?.password),
      JSON.stringify(password),
      'equal?', user && user.password === password
    );

    if (!user || user.password !== password) {
      console.log('❌ Invalid credentials for', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('✅ Credentials OK for', email);
    const token = generateToken(user);
    console.log('✅ Generated token:', token);
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
};

// Availability check remains (email/username) — tolerant & normalized
export async function checkAvailability(req, res) {
  try {
    const rawEmail = (req.query.email || req.query.value || '').toString().trim().toLowerCase();
    const rawUsername = (req.query.username || req.query.value || '').toString().trim().toLowerCase();

    const result = {
      email: { query: rawEmail || null, available: true },
      username: { query: rawUsername || null, available: true }
    };

    if (rawEmail) {
      const existsEmail = await User.exists({ email: rawEmail });
      result.email.available = !existsEmail;
    }

    if (rawUsername) {
      const existsUsername = await User.exists({ username: rawUsername });
      result.username.available = !existsUsername;
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Availability check failed', details: err.message });
  }
}
