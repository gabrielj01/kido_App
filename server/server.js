// server/server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import { connectDB } from "./src/config/mongo.js";
import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import validationRoutes from "./src/routes/validation.routes.js";
import babysitterRoutes from "./src/routes/babysitter.routes.js";
import bookingRoutes from "./src/routes/booking.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => res.send("API Babysitting — OK"));

// API routes
app.use("/api/validate", validationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/babysitters", babysitterRoutes);
app.use("/api/bookings", bookingRoutes);

// Static uploads (cache long)
app.use(
  "/uploads",
  (req, res, next) => {
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

// 404 fallback
app.use((req, res) => res.status(404).json({ error: "Not found" }));

const port = process.env.PORT || 4000;

async function bootstrap() {
  await connectDB();
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error:", err);
  process.exit(1);
});
