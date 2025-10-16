import api from "../api/client";
import { CLOUDINARY } from "../config";

/** Normalize boolean availability responses coming from various endpoints */
function normalizeAvailable(data) {
  if (typeof data?.available === "boolean") return data.available;
  if (typeof data?.exists === "boolean") return !data.exists;
  if (typeof data?.isFree === "boolean") return data.isFree;
  throw new Error("Unexpected server response");
}

export async function checkEmailAvailability(email) {
  const { data } = await api.get("/api/validate/email", {
    params: { email, value: email },
  });
  return normalizeAvailable(data);
}

export async function checkUsernameAvailability(username) {
  const { data } = await api.get("/api/validate/username", {
    params: { username, value: username },
  });
  return normalizeAvailable(data);
}

/** Best-effort mime detection from local file uri */
function guessMime(uri) {
  if (!uri) return "image/jpeg";
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}


//Upload a local image (file://) directly to Cloudinary using the unsigned preset.

export async function uploadAvatarToCloudinary(localUri) {
  const file = {
    uri: localUri,
    type: guessMime(localUri),
    name: `avatar_${Date.now()}`,
  };

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY.UPLOAD_PRESET);
  form.append("folder", CLOUDINARY.FOLDER);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY.CLOUD_NAME}/image/upload`;

  const res = await fetch(endpoint, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed: ${text}`);
  }
  const json = await res.json();
  return json.secure_url;
}

/** Update current user's profile on backend */
export async function updateProfile(payload) {
  // Keep the same signature as before (axios response) to avoid breaking callers
  return api.put("/api/users/me", payload);
}

/** Get current user's profile */
export async function getMyProfile() {
  const { data } = await api.get("/api/users/me");
  return data;
}
