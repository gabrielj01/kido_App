// middleware/auth.js
// Minimal JWT guard with clean error messages.
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const [scheme, token] = auth.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header (use Bearer <token>)' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    // attach to req for downstream controllers
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch (err) {
    // Common cases: TokenExpiredError, JsonWebTokenError
    return res.status(401).json({ error: 'Invalid or expired token', details: err.message });
  }
}

// Helper to ensure the authenticated user matches :id
export function requireSelfOrAdmin(req, res, next) {
  const { id } = req.params;
  if (req.user?.id === id) return next();
  // If you plan admins later:
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ error: 'Forbidden: you can only modify your own profile.' });
}

export const auth = (req, res, next) => {
  // Expect header: Authorization: Bearer <token>
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.split(" ");

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    // attach user id & role on request for downstream handlers
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (e) {
    return res.status(401).json({ message: "Token invalid or malformed" });
  }
};