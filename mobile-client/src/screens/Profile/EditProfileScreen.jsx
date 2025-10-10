import React, { useEffect, useState } from "react";
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

const pickPrefer = (a, b) => (a != null && a !== "" ? a : b);

// --------------------------------- main ---------------------------------

export default function EditProfileScreen() {
  const navigation = useNavigation();

  const { user: u0 = {}, setUser } = (useAuth?.() ?? {});
  const api = ApiClient.default || ApiClient.api || ApiClient.client || null;

  const role = u0?.role || u0?.type || "parent";
  const isSitter = role === "sitter" || role === "babysitter";
  const address = u0?.address || {};

  // Base identity
  const [name, setName] = useState(v(u0?.name || u0?.fullName, ""));
  const [email, setEmail] = useState(v(u0?.email, ""));
  const [phone, setPhone] = useState(v(u0?.phone, ""));

  // Address + sitter
  const [city, setCity] = useState(v(address?.city, ""));
  const [street, setStreet] = useState(v(address?.street, ""));
  const [workRadiusKm, setWorkRadiusKm] = useState(
    v(u0?.workRadiusKm ?? address?.radiusKm ?? "", "")
  );

  // Sitter fields
  const [hourlyRate, setHourlyRate] = useState(v(u0?.hourlyRate ?? u0?.rate ?? "", ""));
  // Experience is tricky; support both experienceYears and experience (string/number/array)
  const initYears =
    u0?.experienceYears ??
    (Array.isArray(u0?.experience) ? undefined :
      (typeof u0?.experience === "number" ? u0.experience :
        (typeof u0?.experience === "string" ? Number(u0.experience.replace(/[^\d]/g, "")) : undefined)));
  const [experienceYears, setExperienceYears] = useState(v(initYears ?? "", ""));
  const [certificationsCsv, setCertificationsCsv] = useState(toCsv(u0?.certifications || []));

  // Parent fields
  const prefs = u0?.preferences || {};
  const [dietaryCsv, setDietaryCsv] = useState(toCsv(prefs?.dietary || u0?.dietary || []));
  const [languagesCsv, setLanguagesCsv] = useState(toCsv(prefs?.languages || u0?.languages || []));
  const [preferredGender, setPreferredGender] = useState(v(prefs?.preferredGender || "", ""));

  // Avatar state (Cloudinary final URL once uploaded)
  const [avatarPreview, setAvatarPreview] = useState(u0?.photoUrl || u0?.avatarUrl || "");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  // -------------------------- hydration from /me -------------------------

  async function fetchMe() {
    // Try service if available
    if (typeof UserService.getMe === "function") {
      const res = await UserService.getMe();
      return res?.data?.user || res?.data || res;
    }
    if (api?.get) {
      const { data } = await api.get("/api/users/me");
      return data?.user || data;
    }
    const baseUrl =
      config?.API_URL ||
      config?.API_BASE_URL ||
      ApiClient?.default?.defaults?.baseURL ||
      "";
    const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/users/me`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data?.user || data;
  }

  // Hydrate form with server values on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setHydrating(true);
      try {
        const me = await fetchMe();
        if (!mounted || !me) return;

        // Merge into global auth state
        if (typeof setUser === "function") setUser({ ...(u0 || {}), ...me });

        // Re-init local form fields from server truth
        const addr = me?.address || {};
        const eraw = me?.experience;
        const eYears =
          me?.experienceYears ??
          (Array.isArray(eraw) ? undefined :
            (typeof eraw === "number" ? eraw :
             (typeof eraw === "string" ? Number(eraw.replace(/[^\d]/g, "")) : undefined)));

        setName(v(me?.name || me?.fullName, ""));
        setEmail(v(me?.email, ""));
        setPhone(v(me?.phone, ""));
        setCity(v(addr?.city, ""));
        setStreet(v(addr?.street, ""));
        setWorkRadiusKm(v(me?.workRadiusKm ?? addr?.radiusKm ?? "", ""));
        setHourlyRate(v(me?.hourlyRate ?? me?.rate ?? "", ""));
        setExperienceYears(v(eYears ?? "", ""));
        setCertificationsCsv(toCsv(me?.certifications || []));
        setAvatarPreview(me?.photoUrl || me?.avatarUrl || "");
        if (me?.preferences) {
          setDietaryCsv(toCsv(me.preferences.dietary || []));
          setLanguagesCsv(toCsv(me.preferences.languages || []));
          setPreferredGender(v(me.preferences.preferredGender || "", ""));
        }
      } catch (e) {
        console.log("[Profile hydrate] error:", e?.message || e);
      } finally {
        setHydrating(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------- avatar upload (Cloudinary) ----------------

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

      // Show local preview immediately
      setAvatarPreview(local);
      setUploading(true);

      // 1) Upload to Cloudinary (unsigned preset)
      const secureUrl = await UserService.uploadAvatarToCloudinary(local);

      // 2) Persist in backend profile (store Cloudinary URL)
      await tryUpdateProfile({ photoUrl: secureUrl, avatarUrl: secureUrl });

      // 3) Reflect in UI/state
      if (typeof setUser === "function") {
        setUser({ ...u0, photoUrl: secureUrl, avatarUrl: secureUrl });
      }
      setAvatarPreview(secureUrl);
      Alert.alert("Updated", "Your profile picture has been updated.");
    } catch (err) {
       console.error('[Upload avatar] error:', err?.response?.data || err?.message || err);
       const serverMsg =
         err?.response?.data?.message ||
         err?.response?.data?.error ||
         err?.message ||
         'Upload failed';
       Alert.alert("Upload failed", String(serverMsg));
      setAvatarPreview(u0?.photoUrl || u0?.avatarUrl || "");
    } finally {
      setUploading(false);
    }
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
      // Keep both aliases for backward compatibility with various readers in the app
      base.photoUrl = avatarPreview;
      base.avatarUrl = avatarPreview;
    }

    if (isSitter) {
      const radiusNum = toNum(workRadiusKm);
      const rateNum = toNum(hourlyRate);
      const expNum = toNum(experienceYears);

      base.workRadiusKm    = radiusNum;
      base.hourlyRate      = rateNum;

      // Send both experienceYears and a normalized "experience" (back-compat with backend)
      base.experienceYears = expNum;
      base.experience      = pickPrefer(expNum, undefined);

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
    if (api?.put) {
      try {
        return await api.put("/api/users/me", payload);
      } catch (e) {
        const id = u0?._id || u0?.id;
        if (id) return await api.put(`/api/users/${id}`, payload);
        throw e;
      }
    }
    const baseUrl =
      config?.API_URL ||
      config?.API_BASE_URL ||
      ApiClient?.default?.defaults?.baseURL ||
      "";
    const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/users/me`, {
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
       console.error('[Save profile] error:', err?.response?.data || err?.message || err);
       const serverMsg =
         err?.response?.data?.message ||
         err?.response?.data?.error ||
         err?.message ||
         'Failed to save your profile';
       Alert.alert("Error", String(serverMsg));
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
                  style={[styles.smallBtn, (uploading || hydrating) && { opacity: 0.7 }]}
                  disabled={uploading || hydrating}
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
                    disabled={uploading || hydrating}
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
              placeholder="e.g. 2"
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
          </View>
        )}

        {/* ACTIONS */}
        <Pressable
          onPress={onSave}
          style={[styles.primaryCta, (submitting || uploading || hydrating) && { opacity: 0.7 }]}
          disabled={submitting || uploading || hydrating}
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
          disabled={submitting || hydrating}
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
