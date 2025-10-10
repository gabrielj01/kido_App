// src/screens/Babysitter/PayoutsScreen.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
  Pressable, // same approach as SitterRequests tabs
} from "react-native";
import Screen from "../../components/Screen";
import { colors } from "../../theme/color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

// Earnings helpers (client-side filtering & aggregation)
import {
  fetchSitterBookings,
  filterCompletedInRange,
  computeEarnings,
  rangeThisWeek,
  rangeLastWeek,
  rangeThisMonth,
  rangeAllTime,
  fmtILS,
  toCSV,
} from "../../services/earningsService";

// Period tabs (keys used by computeRangeForKey)
const PERIODS = [
  { key: "all_time", label: "All time" },
  { key: "this_month", label: "This month" },
  { key: "this_week", label: "This week" },
  { key: "last_week", label: "Last week" },
];

// ---------- Small UI helpers ----------
function SectionTitle({ children }) {
  return (
    <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textDark, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

function Stat({ label, value, sub }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFF8F6",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        padding: 10,
      }}
    >
      <Text style={{ color: colors.textLight, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.textDark, fontSize: 18, fontWeight: "800", marginTop: 4 }}>
        {value}
      </Text>
      {sub ? (
        <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 2 }}>{sub}</Text>
      ) : null}
    </View>
  );
}

function Row({ item }) {
  // Defensive casting: avoid .toFixed() on undefined/string
  const hours = Number(item.hours ?? 0);
  const rate = Number(item.rate ?? 0);
  const amount = Number(item.amount ?? rate * hours) || 0;

  const d = new Date(item.date);
  const dateStr = `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.textDark, fontWeight: "800" }}>{item.parentName || "Parent"}</Text>
        <Text style={{ color: colors.textDark, fontWeight: "800" }}>{fmtILS(amount)}</Text>
      </View>
      <Text style={{ color: colors.textLight, marginTop: 4 }}>{dateStr}</Text>
      <Text style={{ color: colors.textLight, marginTop: 4 }}>
        {hours.toFixed(2)} h @ ₪{rate.toFixed(2)}/h
      </Text>
    </View>
  );
}

function PrimaryButton({ onPress, children }) {
  // Make the whole button tappable (same spirit as Requests actions)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Export payouts as CSV"
      style={{
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 8,
      }}
    >
      <Ionicons name="share-social-outline" size={18} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "800" }}>{children}</Text>
    </Pressable>
  );
}

// ---------- Main Screen ----------
export default function PayoutsScreen() {
  // Same pattern as SitterRequests: local filter state + side-effects
  const [period, setPeriod] = useState("all_time");
  const [range, setRange] = useState(() => rangeAllTime());

  const [bookings, setBookings] = useState([]);
  const [agg, setAgg] = useState({
    jobs: 0,
    totalHours: 0,
    totalEarnings: 0,
    avgHourly: 0,
    rows: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Compute [start, end] from key (pure function)
  const computeRangeForKey = useCallback((key) => {
    const now = new Date();
    if (key === "this_week") return rangeThisWeek(now);
    if (key === "last_week") return rangeLastWeek(now);
    if (key === "this_month") return rangeThisMonth(now);
    return rangeAllTime();
  }, []);

  // Aggregate earnings from completed bookings in the selected range
  const recompute = useCallback((all, r) => {
    const selected = filterCompletedInRange(all, r.start, r.end);
    const a = computeEarnings(selected);
    setAgg(a);
  }, []);

  // Called by tabs; mirrors SitterRequests setFilter()
  const selectPeriod = useCallback(
    (key) => {
      const r = computeRangeForKey(key);
      setPeriod(key);
      setRange(r); // recompute will run via useEffect below
    },
    [computeRangeForKey]
  );

  // Whenever bookings or range changes, recompute (like Requests reload on filter change)
  useEffect(() => {
    recompute(bookings, range);
  }, [bookings, range, recompute]);

  // Load all sitter bookings (we filter client-side by period)
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const all = await fetchSitterBookings();
      setBookings(all);
      // also recompute immediately with current range
      recompute(all, range);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Failed to load earnings";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }, [range, recompute]);

  // Initial + on focus (same pattern as Requests)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // ----- CSV export (legacy API is fine via /legacy import) -----
  const onExportCsv = useCallback(async () => {
    try {
      // Build CSV (BOM for Excel)
      const csv = "\uFEFF" + toCSV(agg.rows);

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const dir = FileSystem.cacheDirectory + "exports/";
      const filename = `Payouts_${y}-${m}-${d}.csv`;
      const uri = dir + filename;

      // Ensure dir exists
      try {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      } catch {
        /* noop */
      }

      await FileSystem.writeAsStringAsync(uri, csv, { encoding: "utf8" });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "text/csv",
          dialogTitle: "Export Payouts",
          UTI: "public.comma-separated-values-text",
        });
      } else {
        // Fallback (some environments can't share a file handle)
        try {
          const contentUri = FileSystem.getContentUriAsync
            ? await FileSystem.getContentUriAsync(uri)
            : uri;
          await Share.share({ url: contentUri, title: filename });
        } catch {
          await Share.share({ message: csv, title: filename });
        }
      }
    } catch (e) {
      Alert.alert("Export failed", e.message || "Could not export CSV.");
    }
  }, [agg.rows]);

  // Tabs component (exact same *manner* as SitterRequests: Pressable chips)
  const Tabs = useMemo(
    () => (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {PERIODS.map((opt) => {
          const active = period === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => selectPeriod(opt.key)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : "transparent",
              }}
            >
              <Text style={{ color: active ? "#fff" : colors.textDark, fontWeight: "700" }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [period, selectPeriod]
  );

  // Header used both in empty and list cases
  const header = useMemo(
    () => (
      <View>
        <Text style={{ color: colors.textLight, marginBottom: 10 }}>
          Payments are on-site. This summary shows your completed bookings and earnings.
        </Text>

        {Tabs}

        {/* KPIs */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
          <Stat label="Earnings" value={fmtILS(Number(agg.totalEarnings || 0))} />
          <Stat label="Jobs" value={String(agg.jobs || 0)} />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <Stat label="Hours" value={`${Number(agg.totalHours || 0).toFixed(2)} h`} />
          <Stat label="Avg hourly" value={`₪${Number(agg.avgHourly || 0).toFixed(2)}/h`} />
        </View>

        {/* Actions */}
        <PrimaryButton onPress={onExportCsv}>Export CSV</PrimaryButton>

        <View style={{ height: 10 }} />

        <SectionTitle>Completed bookings</SectionTitle>
      </View>
    ),
    [Tabs, agg, onExportCsv]
  );

  return (
    // Tight top spacing: rely on navigation header
    <Screen edges={[]}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
        {loading ? (
          <View style={{ alignItems: "center", marginTop: 16 }}>
            <ActivityIndicator />
            <Text style={{ color: colors.textLight, marginTop: 8 }}>Loading…</Text>
          </View>
        ) : agg.rows.length === 0 ? (
          <>
            {header}
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <Text style={{ color: colors.textDark, fontWeight: "700" }}>No completed bookings</Text>
              <Text style={{ color: colors.textLight, marginTop: 4 }}>
                There are no completed bookings for the selected period.
              </Text>
            </View>
          </>
        ) : (
          <FlatList
            data={agg.rows}
            keyExtractor={(it, idx) => String(it.id ?? it._id ?? idx)}
            renderItem={({ item }) => <Row item={item} />}
            ListHeaderComponent={header}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        )}
      </View>
    </Screen>
  );
}
