import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Switch,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import RatingStars from "../../components/RatingStars";
import { getUpcomingBookings } from "../../api/bookingApi";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../../components/Screen";
import api from "../../api/client";
import { fetchBabysitterReviews, computeReviewStats } from "../../services/reviewsService";

const COLORS = {
  bg: "#F6FAFF",
  card: "#FFFFFF",
  text: "#2E3A59",
  textMuted: "#6B7A99",
  border: "#E6ECF5",
  primary: "#ff7a59ff",
  primaryDark: "#FF5C36",
  accent: "#6EDCCF",
  success: "#0EAD69",
  danger: "#C53F3F",
};

export default function SitterHome({ navigation }) {
  const { user: authUser, logout } = useAuth?.() || { user: null, logout: () => {} };
  const sitterId = authUser?._id || authUser?.id;

  const [accepting, setAccepting] = useState(true);
  const [upcoming, setUpcoming] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Live profile (refreshed from /users/me to ensure latest fields like rating on profile if present)
  const [profile, setProfile] = useState(authUser || null);

  // Real stats pulled from API
  const [stats, setStats] = useState({
    jobs: 0,
    responseRate: null, // percent or null
    rating: 0,
    reviewsCount: 0,
    weekEarnings: 0,
  });

  // ---- Helpers to navigate safely ----
  const tryNavigate = (routeName, params) => {
    try {
      if (navigation?.navigate) navigation.navigate(routeName, params);
      else Alert.alert("Navigation", `Wire this to "${routeName}" screen.`);
    } catch {
      Alert.alert("Navigation", `Screen "${routeName}" not found yet.`);
    }
  };

  const firstName =
    profile?.firstName || profile?.name || profile?.fullName || "Babysitter";

  // ---- Data loaders ----

  // 1) Refresh sitter profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get("/api/users/me");
      const data = res?.data?.data || res?.data || null;
      if (data) setProfile(data);
    } catch (e) {
      // not blocking; use authUser fallback
    }
  }, []);

  // 2) Upcoming bookings (confirmed only)
  const loadUpcoming = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const list = await getUpcomingBookings({ limit: 5, status: "accepted" });
      setUpcoming(Array.isArray(list) ? list : []);
    } catch (e) {
      console.log("Load upcoming (sitter) failed:", e?.response?.data || e.message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 3) Reviews → rating & reviewsCount
  const loadReviewsStats = useCallback(async () => {
    if (!sitterId) return { rating: 0, reviewsCount: 0 };
    try {
      const { items } = await fetchBabysitterReviews(sitterId, { page: 1, limit: 200 }); // enough for UI
      const agg = computeReviewStats(items);
      return { rating: agg.avg, reviewsCount: agg.count };
    } catch (e) {
      return { rating: 0, reviewsCount: 0 };
    }
  }, [sitterId]);

  // 4) Bookings aggregate → jobs (completed count), responseRate, weekEarnings
  const loadBookingsAggregates = useCallback(async () => {
    try {
      const res = await api.get("/api/bookings", { params: { role: "sitter" } });
      const list = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data)
        ? res.data
        : [];

      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);

      let completed = 0;
      let accepted = 0;
      let declined = 0;
      let weekEarnings = 0;

      for (const b of list) {
        const status = String(b?.status || "").toLowerCase();
        if (status === "accepted") accepted++;
        if (status === "declined") declined++;
        if (status === "completed") {
          completed++;
          // weekly earnings: sum totalPrice of completed bookings within last 7 days
          const end = new Date(b.endISO || b.endTime || 0);
          if (!Number.isNaN(end) && end >= weekAgo && end <= now) {
            const price =
              Number(b.totalPrice) ||
              (Number(b.rateSnapshot) || 0) * (Number(b.totalHours) || 0);
            weekEarnings += Number.isFinite(price) ? price : 0;
          }
        }
      }

      const decisions = accepted + declined;
      const responseRate = decisions > 0 ? Math.round((accepted / decisions) * 100) : null;

      return { jobs: completed, responseRate, weekEarnings };
    } catch (e) {
      return { jobs: 0, responseRate: null, weekEarnings: 0 };
    }
  }, []);

  // ---- Orchestrate all loads on focus ----
  const loadAll = useCallback(async () => {
    await Promise.all([fetchProfile(), loadUpcoming()]);
    const [rev, agg] = await Promise.all([loadReviewsStats(), loadBookingsAggregates()]);
    setStats((prev) => ({
      ...prev,
      rating: rev.rating,
      reviewsCount: rev.reviewsCount,
      jobs: agg.jobs,
      responseRate: agg.responseRate,
      weekEarnings: agg.weekEarnings,
    }));
  }, [fetchProfile, loadUpcoming, loadReviewsStats, loadBookingsAggregates]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    (async () => {
      await loadAll();
      setRefreshing(false);
    })();
  }, [loadAll]);

  // ---- UI ----
  const ratingDisplay = useMemo(
    () => (typeof stats.rating === "number" ? stats.rating.toFixed(1) : "0.0"),
    [stats.rating]
  );

  return (
    <Screen edges={[""]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        bounces
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.avatarWrap}>
              <Image
                source={{
                  uri: profile?.photoUrl || "https://i.pravatar.cc/150?img=12",
                }}
                style={styles.avatar}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.welcome}>Hi, {firstName} 👋</Text>

              <View style={styles.ratingRow}>
                <RatingStars rating={stats.rating || 0} size={16} />
                <Text style={styles.ratingText}>
                  {ratingDisplay} · {stats.reviewsCount} reviews
                </Text>
              </View>

              <View style={styles.availabilityRow}>
                <Ionicons
                  name={accepting ? "checkmark-circle" : "remove-circle"}
                  size={18}
                  color={accepting ? COLORS.success : COLORS.danger}
                />
                <Text style={styles.availabilityText}>
                  {accepting ? "Accepting bookings" : "Not accepting bookings"}
                </Text>
                <Switch value={accepting} onValueChange={setAccepting} />
              </View>
            </View>
          </View>

          {/* Quick stats */}
          <View style={styles.statsRow}>
            <StatCard icon="briefcase-outline" label="Jobs" value={String(stats.jobs)} />
            <StatCard
              icon="flash-outline"
              label="Response"
              value={stats.responseRate == null ? "—" : `${stats.responseRate}%`}
            />
            <StatCard icon="star-outline" label="Rating" value={ratingDisplay} />
          </View>
        </View>

        {/* Quick actions */}
        <SectionHeader title="Quick actions" />
        <View style={styles.actionsGrid}>
          <QuickAction
            icon={<Ionicons name="chatbubbles" size={22} color="#2E3A59" />}
            label="Requests"
            onPress={() => tryNavigate("Requests")}
          />
          <QuickAction
            icon={<Ionicons name="card" size={22} color="#2E3A59" />}
            label="Payouts"
            onPress={() => tryNavigate("Payouts")}
          />
          <QuickAction
            icon={<Ionicons name="person-circle" size={22} color="#2E3A59" />}
            label="Profile"
            onPress={() => tryNavigate("Profile")}
          />
          <QuickAction
            icon={<FontAwesome5 name="star-half-alt" size={20} color="#2E3A59" />}
            label="Reviews"
            onPress={() =>
              tryNavigate("BabysitterReviews", {
                sitterId,
                sitterName: profile?.name || firstName,
              })
            }
          />
        </View>

        {/* Upcoming bookings */}
        <SectionHeader title="Upcoming bookings" />
        {loading ? (
          <View style={styles.card}>
            <Text style={{ color: COLORS.textMuted }}>Loading…</Text>
          </View>
        ) : upcoming.length === 0 ? (
          <EmptyCard
            title="No bookings yet"
            subtitle="Your confirmed bookings will appear here."
            actionLabel="Browse requests"
            onAction={() => tryNavigate("Requests")}
          />
        ) : (
          <View style={styles.card}>
            {upcoming.map((b, idx) => {
              const start = new Date(b.startISO);
              const end = new Date(b.endISO);
              const dateStr = start.toLocaleDateString();
              const timeStr = `${start.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}–${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
              const parentName = b?.parentId?.name || "—";
              return (
                <View
                  key={b._id || String(idx)}
                  style={[styles.bookingRow, idx < upcoming.length - 1 && styles.rowDivider]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingPrimary}>
                      {dateStr} · {timeStr}
                    </Text>
                    <Text style={styles.bookingSecondary}>With {parentName}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Pressable
                      style={styles.bookingAction}
                      onPress={() => tryNavigate("BookingDetails", { id: b._id })}
                    >
                      <Text style={styles.bookingActionText}>Details</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Earnings */}
        <SectionHeader title="Earnings" />
        <View style={[styles.card, styles.earningsCard]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.earningsTitle}>This week</Text>
            <Text style={styles.earningsValue}>₪{stats.weekEarnings.toFixed(0)}</Text>

          </View>
          <Pressable style={styles.primaryBtn} onPress={() => tryNavigate("Payouts")}>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Go to Payouts</Text>
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

/** Small UI helpers */
function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <View className="stat-card" style={styles.statCard}>
      <Ionicons name={icon} size={18} color="#2E3A59" />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function EmptyCard({ title, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      <Pressable style={styles.secondaryBtn} onPress={onAction}>
        <Text style={styles.secondaryBtnText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    backgroundColor: COLORS.bg,
  },
  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFE8E0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatar: {
    width: 62,
    height: 62,
  },
  welcome: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  availabilityText: {
    color: COLORS.text,
    fontSize: 13,
    marginRight: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FDF3F0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 4,
  },
  statLabel: { fontSize: 12, color: COLORS.textMuted },
  statValue: { fontSize: 16, fontWeight: "700", color: COLORS.text },

  sectionHeader: {
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },

  actionsGrid: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  quickAction: {
    width: "30%",
    aspectRatio: 1,
    backgroundColor: "#FFF8F6",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFE1D7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: "center",
    fontWeight: "600",
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 14,
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bookingPrimary: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  bookingSecondary: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  bookingAction: {
    backgroundColor: "#FFF1ED",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bookingActionText: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: 12,
  },

  earningsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  earningsTitle: { color: COLORS.textMuted, fontSize: 12 },
  earningsValue: { color: COLORS.text, fontSize: 22, fontWeight: "800", marginTop: 2 },
  earningsSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  secondaryBtn: {
    backgroundColor: "#FFF8F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: "center",
    marginTop: 8,
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: "700" },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  emptySubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 6, textAlign: "center" },

  logoutBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#FFF2F2",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutText: { color: COLORS.danger, fontWeight: "700" },
});
