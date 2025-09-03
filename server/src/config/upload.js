import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const serverRoot = path.resolve(__dirname, "../../");
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });


if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Simple disk storage; filenames are timestamped to avoid collisions
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg");
    const name = `u_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  if (!/image\/(jpeg|png|webp)/.test(file.mimetype)) {
    return cb(new Error("Only JPEG/PNG/WEBP images are allowed"));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
