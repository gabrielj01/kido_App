import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadAvatarToCloudinary } from "../../services/userService";
import Ionicons from "@expo/vector-icons/Ionicons";

// --- Optional theme import with safe fallback (match your file name: theme/color.js) ---
let importedDefault, importedNS;
try {
  importedDefault = require("../../theme/color").default;
  importedNS = require("../../theme/color");
} catch (_) {
  importedDefault = null;
  importedNS = {};
}
const importedColors = importedNS?.colors || importedDefault || importedNS?.default || null;

export default function SignupPhoto({ navigation, route }) {
  // Accumulate previous signup data through params (kept flat, not nested)
  const prev = route?.params || {};

  const [localUri, setLocalUri] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(prev?.photoUrl || "");
  const [busy, setBusy] = useState(false);

  // Theme (align with SignupStep1)
  const THEME = useMemo(
    () => ({
      primary: importedColors?.primary ?? "#FF7A59",
      secondary: importedColors?.secondary ?? "#4ECDC4",
      bg: importedColors?.bg ?? "#F7F9FC",
      card: importedColors?.card ?? "#FFFFFF",
      text: importedColors?.textDark ?? "#1F2D3D",
      textMuted: importedColors?.textLight ?? "#6B7A90",
      border: importedColors?.border ?? "#E6ECF2",
      danger: importedColors?.danger ?? "#E63946",
    }),
    []
  );

  const canContinue = useMemo(() => !!uploadedUrl, [uploadedUrl]);

  /** Upload helper (shared by library & camera) */
  const handleUpload = async (assetUri) => {
    setLocalUri(assetUri);
    setBusy(true);
    try {
      const url = await uploadAvatarToCloudinary(assetUri);
      setUploadedUrl(url);
    } catch (e) {
      console.warn("Upload failed:", e?.message);
      Alert.alert("Upload failed", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Pick from library, crop square, upload to Cloudinary (unsigned preset) */
  const chooseFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // square crop
      quality: 0.9,
    });
    if (res.canceled) return;

    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    await handleUpload(asset.uri);
  };

  /** Take a photo with the camera and upload */
  const takePhotoWithCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1], // square crop
      quality: 0.9,
    });
    if (res.canceled) return;

    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    await handleUpload(asset.uri);
  };

  /** Continue to next step with the new photoUrl */
  const onNext = () => {
    if (!canContinue) {
      Alert.alert("Profile photo", "Please add a profile photo before continuing.");
      return;
    }
    navigation.navigate("SignupStep2", { ...prev, photoUrl: uploadedUrl });
  };

  /** Allow skipping the photo (still consistent with your MVP) */
  const onSkip = () => {
    navigation.navigate("SignupStep2", { ...prev });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: THEME.bg }]}>
      {/* Decorative header blobs (same as Step 1) */}
      <View style={styles.headerWrap} pointerEvents="none">
        <View
          style={[
            styles.blob,
            { backgroundColor: THEME.primary, top: -70, left: -50, opacity: 0.18 },
          ]}
        />
        <View
          style={[
            styles.blob,
            {
              backgroundColor: THEME.secondary,
              top: -10,
              right: -60,
              width: 220,
              height: 220,
              opacity: 0.22,
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title (aligned with Step 1) */}
          <View style={styles.titleBox}>
            <Text style={[styles.h1, { color: THEME.text }]}>Add your profile photo</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>
              Step 2 · Profile photo
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            {/* Avatar preview circle */}
            <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <Pressable
                onPress={uploadedUrl || localUri ? undefined : chooseFromLibrary}
                accessibilityRole="button"
                accessibilityLabel="Add profile photo"
              >
                <View
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                    overflow: "hidden",
                    borderWidth: 2,
                    borderColor: THEME.border,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#FFF",
                  }}
                >
                  {uploadedUrl || localUri ? (
                    <Image
                      source={{ uri: uploadedUrl || localUri }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    // Avatar icon (placeholder)
                    <Ionicons
                      name="person-outline"
                      size={72}
                      color={THEME.textMuted}
                      accessibilityLabel="Avatar placeholder"
                    />
                  )}

                  {busy && (
                    <View
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "rgba(255,255,255,0.72)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ActivityIndicator />
                      <Text style={{ marginTop: 6, color: THEME.textMuted, fontSize: 12 }}>
                        Uploading…
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>

            {/* Actions row: camera + library */}
            <View style={styles.row}>
              <Pressable
                onPress={takePhotoWithCamera}
                style={({ pressed }) => [
                  styles.pillBtn,
                  {
                    backgroundColor: THEME.secondary,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Take a photo with your camera"
              >
                <View style={styles.inline}>
                  <Ionicons name="camera-outline" size={18} color="#073B4C" />
                  <Text style={{ color: "#073B4C", fontWeight: "700", marginLeft: 8 }}>
                    Take photo
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={chooseFromLibrary}
                style={({ pressed }) => [
                  styles.pillBtn,
                  {
                    backgroundColor: THEME.primary,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Choose profile photo from your library"
              >
                <View style={styles.inline}>
                  <Ionicons name="image-outline" size={18} color="#FFF" />
                  <Text style={{ color: "#FFF", fontWeight: "700", marginLeft: 8 }}>
                    Choose photo
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Helper note */}
            <Text style={[styles.note, { color: THEME.textMuted, marginTop: 12, textAlign: "center" }]}>
              A friendly face builds trust between parents and babysitters.
            </Text>

            {/* CTA (Next) */}
            <Pressable
              onPress={onNext}
              disabled={!canContinue || busy}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: !canContinue || busy ? "#FFB39F" : THEME.primary,
                  transform: [{ scale: pressed && canContinue && !busy ? 0.98 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Next</Text>}
            </Pressable>

            {/* Secondary (Skip) */}
            <Pressable
              onPress={onSkip}
              disabled={busy}
              style={({ pressed }) => [
                styles.linkBtn,
                { opacity: busy ? 0.6 : 1, transform: [{ scale: pressed && !busy ? 0.98 : 1 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Skip this step"
            >
              <Text style={[styles.linkText, { color: THEME.secondary }]}>Skip for now</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Layout
  safe: { flex: 1 },
  flex: { flex: 1 },
  titleBox: { paddingHorizontal: 24, marginBottom: 12, marginTop: 12 },

  // Decorative header (same visuals as Step 1)
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, height: 180 },
  blob: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 120,
    transform: [{ rotate: "10deg" }],
  },

  // Typography
  h1: { fontSize: 28, fontWeight: "700", letterSpacing: 0.2 },
  sub: { marginTop: 6, fontSize: 14 },

  // Card container (same shadow/radius)
  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  // Row for action buttons
  row: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 6,
  },
  inline: { flexDirection: "row", alignItems: "center" },

  // CTA primary
  cta: {
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  ctaText: { color: "#FFF", fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },

  // Secondary link
  linkBtn: { alignItems: "center", paddingVertical: 12 },
  linkText: { fontSize: 14, fontWeight: "700" },

  // Rounded primary small button
  pillBtn: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },

  // Notes
  note: { fontSize: 12, lineHeight: 16 },
});
