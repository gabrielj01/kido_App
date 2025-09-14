// mobile-client/src/screens/Profile/ProfileScreen.jsx
import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  Alert,
  StyleSheet,
  RefreshControl,
  I18nManager
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { colors } from "../../theme/color";
import Chip from "../../components/Chip";
import RatingStars from "../../components/RatingStars";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/client"; // axios instance with token

function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}

function v(value, fallback = "—") {
  if (value === 0) return "0";
  return value ? String(value) : fallback;
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, setUser, logout } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch user profile from API and hydrate the global auth state
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get("/api/users/me");
      setUser?.(data);
    } catch (err) {
      console.log("Profile fetch error:", err?.response?.data || err.message);
    }
  }, [setUser]);

  // Re-fetch every time the screen gains focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!active) return;
        await fetchProfile();
      })();
      return () => {
        active = false;
      };
    }, [fetchProfile])
  );

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile().finally(() => setRefreshing(false));
  }, [fetchProfile]);

  // Defensive fields (avoid crashes if backend shape evolves)
  const role = user?.role || user?.type || "parent"; // "parent" | "sitter" | "babysitter"
  const isSitter = role === "sitter" || role === "babysitter";
  const name = user?.name || user?.fullName || "Your name";
  const email = user?.email;
  const phone = user?.phone;
  const avatarUrl = user?.photoUrl || user?.avatarUrl;

  // Babysitter extras
  const ratingAvg = user?.ratingAvg ?? user?.rating ?? 0;
  const ratingCount = user?.ratingCount ?? 0;
  const hourlyRate = user?.hourlyRate ?? user?.rate ?? null;
  const experienceYears = user?.experienceYears ?? null;
  const certifications = Array.isArray(user?.certifications)
    ? user.certifications
    : [];

  // Parent extras
  const kids = Array.isArray(user?.kids) ? user.kids : [];
  const preferences = user?.preferences || {};
  const dietary = preferences?.dietary || user?.dietary || [];
  const languages = preferences?.languages || user?.languages || [];
  const preferredGender = preferences?.preferredGender || null;

  // Address
  const address = user?.address || {};
  const city = address?.city;
  const street = address?.street;
  const workRadiusKm = user?.workRadiusKm ?? address?.radiusKm ?? null;

  // Simple stat pills for sitter
  const sitterStats = useMemo(() => {
    const items = [];
    items.push({
      label: "Bookings",
      value: v(user?.stats?.bookingsCompleted ?? user?.bookingsCompleted, "0"),
    });
    items.push({
      label: "Rating",
      value:
        ratingCount > 0 ? `${Number(ratingAvg).toFixed(1)} (${ratingCount})` : "—",
    });
    items.push({
      label: "Rate",
      value: hourlyRate ? `${hourlyRate} ₪/h` : "—",
    });
    return items;
  }, [user, ratingAvg, ratingCount, hourlyRate]);

  function onEditProfile() {
    navigation.navigate("EditProfile"); // assumes your navigator screen name
  }

  function onLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          try {
            logout?.();
          } catch (e) {
            Alert.alert("Error", "Failed to log out. Please try again.");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.container}>
        {/* Header Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarTxt}>{getInitials(name)}</Text>
              </View>
            )}

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.userName}>{name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                <Chip label={isSitter ? "Babysitter" : "Parent"} />
                {isSitter && (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <RatingStars rating={Number(ratingAvg) || 0} size={16} />
                    <Text style={[styles.muted, { marginLeft: 6 }]}>
                      {ratingCount > 0 ? `(${ratingCount})` : "(no reviews)"}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <Pressable onPress={onEditProfile} style={styles.editBtn}>
              <Text style={styles.editBtnTxt}>Edit</Text>
            </Pressable>
          </View>

          {/* Sitter quick stats */}
          {isSitter && (
            <View style={styles.statsRow}>
              {sitterStats.map((s, idx) => (
                <View key={idx} style={styles.statPill}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Personal Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal info</Text>
          <InfoRow label="Full name" value={v(name)} />
          <InfoRow label="Email" value={v(email)} />
          <InfoRow label="Phone" value={v(phone)} />
        </View>

        {/* Address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Address</Text>
          <InfoRow label="City" value={v(city)} />
          <InfoRow label="Street" value={v(street)} />
          {isSitter && <InfoRow label="Work radius" value={workRadiusKm ? `${workRadiusKm} km` : "—"} />}
        </View>

        {/* Role-specific section */}
        {isSitter ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Experience & Certifications</Text>
            <InfoRow label="Experience" value={experienceYears ? `${experienceYears} years` : "—"} />
            <ListRow
              label="Certifications"
              items={certifications}
              emptyText="No certifications added"
            />
            {hourlyRate != null && (
              <InfoRow label="Hourly rate" value={`${hourlyRate} ₪/h`} />
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Preferences</Text>
            <InfoRow label="Children" value={kids.length ? `${kids.length}` : "—"} />
            <ListRow
              label="Dietary"
              items={Array.isArray(dietary) ? dietary : []}
              emptyText="No dietary restrictions"
            />
            <ListRow
              label="Languages"
              items={Array.isArray(languages) ? languages : []}
              emptyText="No language preference"
            />
            <InfoRow
              label="Preferred sitter"
              value={preferredGender ? String(preferredGender) : "—"}
            />
          </View>
        )}

        {/* Actions */}
        <Pressable onPress={onEditProfile} style={styles.primaryCta}>
          <Text style={styles.primaryCtaTxt}>Edit Profile</Text>
        </Pressable>

        <Pressable onPress={onLogout} style={styles.outlineCta}>
          <Text style={styles.outlineCtaTxt}>Log out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** Reusable rows */
function InfoRow({ label, value }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

function ListRow({ label, items, emptyText = "—" }) {
  const has = Array.isArray(items) && items.length > 0;
  const isRTL = I18nManager.isRTL;
  return (
    <View
       style={[
         rowStyles.row,
         {
           alignItems: "flex-start",
           justifyContent: "flex-start",
           flexDirection: isRTL ? "row-reverse" : "row",
         },
       ]}
     >
      <Text style={rowStyles.label}>{label}</Text>
      {has ? (
        <View
           style={{
             // Keep chips visually starting from the LEFT
             flex: 1,
             flexDirection: isRTL ? "row-reverse" : "row",
             flexWrap: "wrap",
             justifyContent: "flex-start",
             alignItems: "flex-start",
             alignContent: "flex-start",
             gap: 8,
           }}
         >
          {items.map((it, idx) => (
            <View
              key={`${String(it)}-${idx}`}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                borderRadius: 16,
                paddingHorizontal: 10,
                paddingVertical: 6,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: colors.textDark }}>{String(it)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={rowStyles.value}>{emptyText}</Text>
      )}
    </View>
  );
}

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
  headerRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#eee" },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarTxt: { fontWeight: "800", fontSize: 18, color: colors.textDark },
  userName: { fontSize: 18, fontWeight: "800", color: colors.textDark },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
    backgroundColor: colors.bg,
  },
  editBtnTxt: { color: colors.textDark, fontWeight: "700" },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  statPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: "center",
  },
  statValue: { fontWeight: "800", color: colors.textDark },
  statLabel: { marginTop: 4, color: colors.textLight },

  cardTitle: { fontWeight: "700", color: colors.textDark, marginBottom: 10 },

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
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: { color: colors.textLight, flex: 1.2 },
  value: { color: colors.textDark, fontWeight: "600", flex: 2 },
});
