// server/src/controllers/userController.js
import User from "../models/User.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "../../");
const uploadsDir = path.join(serverRoot, "uploads");

/** Safely delete a file if it exists (sync, simple & robust for MVP) */
const deleteFileIfExists = (absolutePath) => {
  try {
    if (!absolutePath) return;
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  } catch (err) {
    console.warn("deleteFileIfExists error:", err?.message);
  }
};

/**
 * Normalize/clean incoming patch payloads before Mongo updates.
 * - Avoids CastError when address is an object while schema expects a string.
 * - Soft-casts numeric inputs coming as strings.
 * - Coerces CSV-like strings to arrays for certain fields.
 */
function normalizePatch(patch) {
  const out = { ...patch };

  // ---- Address: if an object came from mobile { city, street, radiusKm } ----
  // If your schema defines `address` as String, keep it a string to avoid CastError.
  // We serialize to "street, city". If both are empty, keep empty string.
  if (out.address && typeof out.address === "object" && !Array.isArray(out.address)) {
    const { city = "", street = "", radiusKm } = out.address || {};
    const pieces = [street?.trim(), city?.trim()].filter(Boolean);
    out.address = pieces.join(", "); // e.g. "Herzl 12, Tel Aviv"
    if (radiusKm !== undefined && out.workRadiusKm === undefined) {
      // expose radiusKm at root if needed by your app
      out.workRadiusKm = Number(radiusKm) || 0;
    }
  }

  // ---- Numeric soft-casts (common when inputs come from text fields) ----
  const numericKeys = ["hourlyRate", "experienceYears", "latitude", "longitude", "workRadiusKm"];
  for (const key of numericKeys) {
    if (out[key] !== undefined && out[key] !== null && out[key] !== "") {
      const n = Number(out[key]);
      out[key] = Number.isFinite(n) ? n : 0;
    }
  }

  // ---- Arrays normalization (CSV -> array) ----
  const csvToArray = (v) =>
    Array.isArray(v)
      ? v
      : String(v || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  if (out.certifications !== undefined) {
    out.certifications = csvToArray(out.certifications);
  }

  // Defensive trims on common string fields
  const stringKeys = ["name", "email", "phone", "bio", "photoUrl", "avatarUrl", "username", "role"];
  for (const k of stringKeys) {
    if (typeof out[k] === "string") out[k] = out[k].trim();
  }

  return out;
}

// ---------- Public reads / self profile ----------

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password -__v");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to fetch user", details: err.message });
  }
}

export async function listUsers(req, res) {
  try {
    const filter = {};
    if (req.query.role) {
      const norm = String(req.query.role).toLowerCase().trim();
      // Accept synonyms: sitter → babysitter
      filter.role = ["sitter", "sitters"].includes(norm) ? "babysitter" : norm;
    }
    const users = await User.find(filter)
      .select("-password -__v")
      .sort({ createdAt: -1 });
    return res.json(users);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to list users", details: err.message });
  }
}


export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Failed to fetch profile", details: err.message });
  }
};

// ---------- Updates ----------

export async function updateUserById(req, res) {
  try {
    const { id } = req.params;

    // Basic permission: user can update himself; admins can update others
    if (req.user?.id !== id && req.user?.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: cannot update another user" });
    }

    // Whitelist fields we allow to be updated via this endpoint
    const allowed = [
      "name",
      "username",
      "address",         // may be object or string
      "latitude",
      "longitude",
      "hourlyRate",
      "experienceYears", // prefer explicit years field
      "workRadiusKm",
      "certifications",
      "age",
      "photoUrl",
      "bio",
      "languages",
      "dietary",
      "preferences",     // if your schema supports it
      "role"             // optional: if admins promote/demote roles
    ];

    const rawPatch = {};
    for (const k of allowed) {
      if (k in req.body) rawPatch[k] = req.body[k];
    }
    const patch = normalizePatch(rawPatch);

    // Simple business rule example
    if (patch.hourlyRate != null && Number(patch.hourlyRate) < 0) {
      return res.status(400).json({ error: "hourlyRate cannot be negative" });
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).select("-password -__v");

    if (!updated) return res.status(404).json({ error: "User not found" });
    return res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Duplicate key", keyValue: err.keyValue });
    }
    return res
      .status(500)
      .json({ error: "Failed to update user", details: err.message });
  }
}

export const updateMe = async (req, res) => {
  try {
    // Whitelist for self update
    const allowed = [
      "name",
      "address",        // may be object or string
      "latitude",
      "longitude",
      "hourlyRate",
      "experienceYears",
      "workRadiusKm",
      "certifications",
      "age",
      "bio",
      "photoUrl",
      "languages",
      "dietary",
      "preferences"
    ];

    const raw = {};
    for (const k of allowed) {
      if (k in req.body) raw[k] = req.body[k];
    }
    const payload = normalizePatch(raw);

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: payload },
      { new: true, runValidators: true }
    ).select("-password -__v");

    if (!updated) return res.status(404).json({ message: "User not found" });
    return res.json(updated);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Failed to update profile", details: err.message });
  }
};

// ---------- Photo upload / delete ----------

export async function uploadUserPhoto(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const photoUrl = `/uploads/${req.file.filename}`;

    // (Optional) Clean previous local photo if we manage it
    const prev = await User.findById(userId).select("photoUrl").lean();
    if (prev?.photoUrl && prev.photoUrl.includes("/uploads/")) {
      const prevName = prev.photoUrl.split("/uploads/")[1];
      if (prevName) deleteFileIfExists(path.join(uploadsDir, prevName));
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { photoUrl, avatarUrl: photoUrl },
      { new: true }
    ).select("-password -__v");

    return res.status(200).json({ message: "Photo uploaded", photoUrl, user: updated });
  } catch (e) {
    return res.status(500).json({ message: "Upload failed" });
  }
}

export const deleteMyPhoto = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.photoUrl) {
      return res.json({ message: "No photo to delete", user });
    }

    // Only delete local files we control (/uploads/)
    if (user.photoUrl.includes("/uploads/")) {
      const prevName = user.photoUrl.split("/uploads/")[1];
      if (prevName) deleteFileIfExists(path.join(uploadsDir, prevName));
    }

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $unset: { photoUrl: "", avatarUrl: "" } },
      { new: true }
    ).select("-password -__v");

    return res.json({ message: "Photo removed", user: updated });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Failed to delete photo", details: err.message });
  }
};
