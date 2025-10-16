import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

export default function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or malformed Authorization header" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const id = decoded.id || decoded._id;
    req.user = { id, role: decoded.role, ...decoded };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
}
