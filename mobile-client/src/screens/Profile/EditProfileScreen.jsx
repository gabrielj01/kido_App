import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "../../theme/color";

// Robust import for the hook (works with default OR named export)
import * as AuthHook from "../../hooks/useAuth";
const useAuth = AuthHook.useAuth || AuthHook.default;

// Prefer service; fallback to API client
import * as UserService from "../../services/userService";
import * as ApiClient from "../../api/client";
import config from "../../config";

// ------------------------------ helpers ---------------------------------

const v = (value, fallback = "") => (value || value === 0 ? String(value) : fallback);
const toCsv = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");
const fromCsv = (str) =>
  String(str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const toNum = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
};

function inferMime(uri = "") {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

function fileNameFromUri(uri = "", fallback = "avatar.jpg") {
  try {
    const parts = uri.split("/");
    const last = parts[parts.length - 1] || fallback;
    return last.includes(".") ? last : fallback;
  } catch {
    return fallback;
  }
}

function getBaseUrl(api, cfg) {
  return (
    cfg?.API_URL ||
    cfg?.API_BASE_URL ||
    api?.default?.defaults?.baseURL ||
    api?.api?.defaults?.baseURL ||
    api?.client?.defaults?.baseURL ||
    ""
  );
}

function joinUrl(base, path) {
  if (!base) return path;
  try {
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/")) return `${base.replace(/\/+$/, "")}${path}`;
    return `${base.replace(/\/+$/, "")}/${path}`;
  } catch {
    return path;
  }
}

function resolveUploadedUrl(resp, api, cfg) {
  const data = resp?.data?.data || resp?.data || resp || {};
  const base = getBaseUrl(api, cfg);

  let urlLike =
    data.photoUrl || 
    data.url ||
    data.avatarUrl ||
    data.path ||
    data.filename ||
    data.file ||
    "";

  if (!urlLike) return "";
  if (/^https?:\/\//i.test(urlLike)) return urlLike;
  if (urlLike.startsWith("/uploads/")) return joinUrl(base, urlLike);
  if (urlLike.startsWith("uploads/")) return joinUrl(base, `/${urlLike}`);
  if (!urlLike.includes("/")) return joinUrl(base, `/uploads/${urlLike}`);
  return joinUrl(base, urlLike);
}

// --------------------------------- main ---------------------------------

export default function EditProfileScreen() {
  const navigation = useNavigation();

  const { user: u0 = {}, setUser } = (useAuth?.() ?? {});
  const api = ApiClient.default || ApiClient.api || ApiClient.client || null;

  const role = u0?.role || u0?.type || "parent";
  const isSitter = role === "sitter" || role === "babysitter";
  const address = u0?.address || {};

  const [name, setName] = useState(v(u0?.name || u0?.fullName, ""));
  const [email, setEmail] = useState(v(u0?.email, ""));
  const [phone, setPhone] = useState(v(u0?.phone, ""));

  const [city, setCity] = useState(v(address?.city, ""));
  const [street, setStreet] = useState(v(address?.street, ""));
  const [workRadiusKm, setWorkRadiusKm] = useState(
    v(u0?.workRadiusKm ?? address?.radiusKm ?? "", "")
  );

  // Sitter fields
  const [hourlyRate, setHourlyRate] = useState(v(u0?.hourlyRate ?? u0?.rate ?? "", ""));
  const [experienceYears, setExperienceYears] = useState(v(u0?.experienceYears ?? "", ""));
  const [certificationsCsv, setCertificationsCsv] = useState(toCsv(u0?.certifications || []));

  // Parent fields
  const prefs = u0?.preferences || {};
  const [dietaryCsv, setDietaryCsv] = useState(toCsv(prefs?.dietary || u0?.dietary || []));
  const [languagesCsv, setLanguagesCsv] = useState(toCsv(prefs?.languages || u0?.languages || []));
  const [preferredGender, setPreferredGender] = useState(v(prefs?.preferredGender || "", ""));

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState(u0?.photoUrl || u0?.avatarUrl || "");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --------------------------- avatar upload ----------------------------

  async function pickImageAndUpload() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission required", "Please allow photo library access.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (res.canceled) return;

      const local = res.assets?.[0]?.uri;
      if (!local) return;

      setAvatarPreview(local);

      const fname = fileNameFromUri(local, "avatar.jpg");
      const type = inferMime(local);

      const form = new FormData();
      // IMPORTANT: server expects field name 'photo'
      form.append("photo", { uri: local, name: fname, type });

      setUploading(true);
      const resp = await tryUploadAvatar(form);
      const finalUrl = resolveUploadedUrl(resp, ApiClient, config);
      if (!finalUrl) throw new Error("Could not resolve uploaded photo URL");

      if (typeof setUser === "function") {
        setUser({ ...u0, photoUrl: finalUrl, avatarUrl: finalUrl });
      }
      setAvatarPreview(finalUrl);
      Alert.alert("Updated", "Your profile picture has been updated.");
    } catch (err) {
      console.error(err);
      Alert.alert("Upload failed", "Unable to upload your photo. Please try again.");
      setAvatarPreview(u0?.photoUrl || u0?.avatarUrl || "");
    } finally {
      setUploading(false);
    }
  }

  async function tryUploadAvatar(form) {
    // 1) Service canonique (préféré)
    if (typeof UserService.uploadPhoto === "function") {
      return await UserService.uploadPhoto(form);
    }
    // 2) Fallback axios direct
    if (api?.post) {
      const cfg = { headers: { "Content-Type": "multipart/form-data" } };
      return await api.post("/api/users/me/photo", form, cfg);
    }
    // 3) Fallback fetch
    const base = getBaseUrl(ApiClient, config);
    const url = joinUrl(base, "/api/users/me/photo");
    const resp = await fetch(url, { method: "POST", body: form });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  }

  // ---------------------------- profile save ----------------------------

  const buildPayload = () => {
    const base = {
      name: name?.trim(),
      email: email?.trim(),
      phone: phone?.trim(),
      address: { city: city?.trim(), street: street?.trim() },
    };

    if (avatarPreview) {
      base.photoUrl = avatarPreview;
      base.avatarUrl = avatarPreview;
    }

    if (isSitter) {
      // Do not send role; just sitter-specific fields
      base.workRadiusKm    = toNum(workRadiusKm);
      base.hourlyRate      = toNum(hourlyRate);
      base.experienceYears = toNum(experienceYears);
      base.certifications  = fromCsv(certificationsCsv);
    } else {
      base.role = "parent";
      base.preferences = {
        dietary: fromCsv(dietaryCsv),
        languages: fromCsv(languagesCsv),
        preferredGender: preferredGender || undefined,
      };
    }
    return base;
  };

  const tryUpdateProfile = async (payload) => {
    if (typeof UserService.updateProfile === "function") {
      return await UserService.updateProfile(payload);
    }
    // axios fallback with explicit /api
    if (api?.put) {
      try {
        return await api.put("/api/users/me", payload);
      } catch (e) {
        const id = u0?._id || u0?.id;
        if (id) return await api.put(`/api/users/${id}`, payload);
        throw e;
      }
    }
    // fetch fallback
    const base = getBaseUrl(ApiClient, config);
    const resp = await fetch(joinUrl(base, "/api/users/me"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  };

  const onSave = async () => {
    const payload = buildPayload();
    if (!payload.name) return Alert.alert("Missing name", "Please provide your full name.");
    if (!payload.email) return Alert.alert("Missing email", "Please provide your email.");

    setSubmitting(true);
    try {
      const res = await tryUpdateProfile(payload);
      const updated = res?.data?.data || res?.data || res;

      if (typeof setUser === "function" && updated) {
        const avatarEcho =
          updated.photoUrl || updated.avatarUrl || updated.photo || updated.avatar || avatarPreview;
        setUser({ ...u0, ...updated, photoUrl: avatarEcho, avatarUrl: avatarEcho });
      }

      Alert.alert("Saved", "Your profile has been updated.");
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------- UI ---------------------------------

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.container}>
        {/* AVATAR CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile picture</Text>
          <View style={styles.avatarRow}>
            <Image
              source={
                avatarPreview
                  ? { uri: avatarPreview }
                  : require("../../../assets/icon.png")
              }
              style={styles.avatar}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.muted}>Recommended: square image, min 400×400.</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={pickImageAndUpload}
                  style={[styles.smallBtn, uploading && { opacity: 0.7 }]}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.smallBtnTxt}>Change photo</Text>
                  )}
                </Pressable>
                {avatarPreview ? (
                  <Pressable
                    onPress={() => setAvatarPreview("")}
                    style={styles.smallBtnOutline}
                    disabled={uploading}
                  >
                    <Text style={styles.smallBtnOutlineTxt}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* PERSONAL INFO */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal info</Text>
          <LabeledInput label="Full name" value={name} onChangeText={setName} />
          <LabeledInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <LabeledInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* ADDRESS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Address</Text>
          <LabeledInput label="City" value={city} onChangeText={setCity} />
          <LabeledInput label="Street" value={street} onChangeText={setStreet} />
          {isSitter && (
            <LabeledInput
              label="Work radius (km)"
              value={String(workRadiusKm)}
              onChangeText={setWorkRadiusKm}
              keyboardType="numeric"
            />
          )}
        </View>

        {/* ROLE-SPECIFIC */}
        {isSitter ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Experience & Certifications</Text>
            <LabeledInput
              label="Hourly rate (₪/h)"
              value={String(hourlyRate)}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
            />
            <LabeledInput
              label="Experience (years)"
              value={String(experienceYears)}
              onChangeText={setExperienceYears}
              keyboardType="numeric"
            />
            <LabeledInput
              label="Certifications (comma-separated)"
              value={certificationsCsv}
              onChangeText={setCertificationsCsv}
              placeholder="First Aid, CPR"
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Preferences</Text>
            <LabeledInput
              label="Dietary (comma-separated)"
              value={dietaryCsv}
              onChangeText={setDietaryCsv}
              placeholder="Kosher, Gluten-free"
            />
            <LabeledInput
              label="Languages (comma-separated)"
              value={languagesCsv}
              onChangeText={setLanguagesCsv}
              placeholder="English, Hebrew, French"
            />
            <LabeledInput
              label="Preferred sitter"
              value={preferredGender}
              onChangeText={setPreferredGender}
              placeholder="Female / Male / Any"
            />
          </View>
        )}

        {/* ACTIONS */}
        <Pressable
          onPress={onSave}
          style={[styles.primaryCta, (submitting || uploading) && { opacity: 0.7 }]}
          disabled={submitting || uploading}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryCtaTxt}>Save changes</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.outlineCta}
          disabled={submitting}
        >
          <Text style={styles.outlineCtaTxt}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// --------------------------- reusable input -----------------------------
function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={rowStyles.input}
      />
    </View>
  );
}

// -------------------------------- styles --------------------------------
const styles = StyleSheet.create({
  container: { padding: 16 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { fontWeight: "700", color: colors.textDark, marginBottom: 10 },
  avatarRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#eee",
    borderWidth: 1,
    borderColor: colors.border,
  },
  muted: { color: colors.textLight },
  smallBtn: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  smallBtnTxt: { color: colors.textDark, fontWeight: "700" },
  smallBtnOutline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  smallBtnOutlineTxt: { color: colors.textDark, fontWeight: "700" },
  primaryCta: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryCtaTxt: { color: "white", fontWeight: "800", fontSize: 16 },
  outlineCta: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 24,
  },
  outlineCtaTxt: { color: colors.textDark, fontWeight: "700" },
});

const rowStyles = StyleSheet.create({
  row: {
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: { color: colors.textLight, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.textDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});