import User from "../models/User.js";

/** Convert UI address object/string to a normalized storage form */
function normalizeAddressToString(addr) {
  if (!addr) return "";
  if (typeof addr === "object" && !Array.isArray(addr)) {
    const { city = "", street = "" } = addr;
    const pieces = [String(street || "").trim(), String(city || "").trim()].filter(Boolean);
    return pieces.join(", "); // e.g. "Herzl 12, Tel Aviv"
  }
  if (typeof addr === "string") return addr;
  return "";
}

/** Coerce/clean incoming patch payload */
function normalizePatch(patch) {
  const out = { ...patch };

  // Address normalization
  if (out.address !== undefined) {
    out.address = normalizeAddressToString(out.address);
    // Optional: accept address.radiusKm into workRadiusKm
    const radiusKm = patch?.address?.radiusKm;
    if (radiusKm !== undefined && out.workRadiusKm === undefined) {
      const n = Number(radiusKm);
      out.workRadiusKm = Number.isFinite(n) ? n : undefined;
    }
  }

  // Numeric soft-casts (when inputs come as strings)
  const numericKeys = ["hourlyRate", "experienceYears", "latitude", "longitude", "workRadiusKm", "age"];
  for (const key of numericKeys) {
    if (out[key] !== undefined && out[key] !== null && out[key] !== "") {
      const n = Number(out[key]);
      out[key] = Number.isFinite(n) ? n : 0;
    }
  }

  // CSV → array normalization
  const csvToArray = (v) =>
    Array.isArray(v)
      ? v
      : String(v || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  if (out.certifications !== undefined) out.certifications = csvToArray(out.certifications);

  // Defensive trims
  const stringKeys = ["name", "email", "phone", "bio", "photoUrl", "avatarUrl", "username", "role"];
  for (const k of stringKeys) {
    if (typeof out[k] === "string") out[k] = out[k].trim();
  }

  return out;
}


function isAllowedCloudinaryUrl(urlStr) {
  try {
    const u = new URL(String(urlStr).trim());

    // Allow res.cloudinary.com and sharded hosts like res-1.cloudinary.com
    if (!/^res(\-\d+)?\.cloudinary\.com$/i.test(u.hostname)) return false;

    // Expected path: /<cloud_name>/image/upload/...
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 3) return false;

    const [cloudFromUrl, resourceType, deliveryType] = parts;
    if (resourceType !== 'image' || deliveryType !== 'upload') return false;

    // Compare with env; if env missing, fail fast
    const cn = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    if (!cn) return false;

    return cloudFromUrl === cn;
  } catch {
    return false;
  }
}


// ----------------------------- CRUD & Profile ---------------------------

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

export async function updateUserById(req, res) {
  try {
    const { id } = req.params;

    // Basic permission: user can update himself; admins can update others
    if (req.user?.id !== id && req.user?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: cannot update another user" });
    }

    // Whitelist of updatable fields
    const allowed = [
      "name",
      "username",
      "address",
      "latitude",
      "longitude",
      "hourlyRate",
      "experienceYears",
      "workRadiusKm",
      "certifications",
      "age",
      "photoUrl",
      "avatar",       // alias (client may send 'avatar')
      "bio",
      "languages",
      "dietary",
      "preferences",
      "role"
    ];

    const rawPatch = {};
    for (const k of allowed) {
      if (k in req.body) rawPatch[k] = req.body[k];
    }
    const patch = normalizePatch(rawPatch);

    // Map alias 'avatar' -> 'photoUrl'
    if (patch.avatar && !patch.photoUrl) patch.photoUrl = patch.avatar;

    // Validate Cloudinary URL for photoUrl (if provided)
    if (patch.photoUrl && !isAllowedCloudinaryUrl(patch.photoUrl)) {
      return res.status(400).json({ error: "Invalid avatar URL" });
    }

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
      "address",
      "latitude",
      "longitude",
      "hourlyRate",
      "experienceYears",
      "workRadiusKm",
      "certifications",
      "age",
      "bio",
      "photoUrl",
      "avatar",     // alias accepted from client
      "languages",
      "dietary",
      "preferences"
    ];

    const raw = {};
    for (const k of allowed) {
      if (k in req.body) raw[k] = req.body[k];
    }
    const payload = normalizePatch(raw);

    // Map alias 'avatar' -> 'photoUrl'
    if (payload.avatar && !payload.photoUrl) payload.photoUrl = payload.avatar;

    // Validate Cloudinary URL
    if (payload.photoUrl && !isAllowedCloudinaryUrl(payload.photoUrl)) {
      return res.status(400).json({ message: "Invalid avatar URL" });
    }

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
