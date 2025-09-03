import api from "../api/client";

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

// Upload current user's profile photo
export async function uploadPhoto(formData) {
  return api.post("/api/users/me/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

// Update current user's profile
export async function updateProfile(payload) {
  return api.put("/api/users/me", payload);
}

