import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import api from "../../api/client";
import ConfirmModal from "../../components/ConfirmModal";
import { colors } from "../../theme/color";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Ionicons } from "@expo/vector-icons";
import { hideBookingById } from "../../api/bookingApi";
import { emit } from "../../contexts/EventBus";
import Screen from "../../components/Screen";

const STATUS = ["all", "pending", "accepted", "declined", "cancelled", "completed"];

function Badge({ label }) {
  const map = {
    pending: { bg: "#FFF3CD", fg: "#8A6D3B" },
    accepted: { bg: "#D4EDDA", fg: "#155724" },
    declined: { bg: "#F8D7DA", fg: "#721C24" },
    cancelled: { bg: "#E2E3E5", fg: "#383D41" },
    completed: { bg: "#D1ECF1", fg: "#0C5460" },
    default: { bg: "#EEE", fg: "#333" },
  };
  const sty = map[label] || map.default;
  return (
    <View style={{ backgroundColor: sty.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ color: sty.fg, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function fmtRange(startISO, endISO) {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const same =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const d = s.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const t = (x) => x.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return same ? `${d} • ${t(s)}–${t(e)}` : `${d} ${t(s)} → ${e.toLocaleDateString()} ${t(e)}`;
}

/** Can the parent hide this booking from their list? */
function canHide(item) {
  const status = item.status;
  const end = new Date(item.endISO || item.endTime || 0);
  const isPast = !Number.isNaN(end) && end < new Date();
  return ["cancelled", "declined", "completed"].includes(status) || isPast;
}

function Row({ item, onCancel, onHide }) {
  const sitter = typeof item.sitterId === "object" ? item.sitterId : null;

  // Right actions sized to match the card height
   const renderRight = (_progress, _dragX) => (
   <View style={{ width: 92, height: "100%", paddingVertical: 0, paddingLeft: 8 }}>
     <Pressable
       onPress={() => onHide(item)}
       style={{
         flex: 1,
         height: "100%",
         backgroundColor: "#E53935",
         justifyContent: "center",
         alignItems: "center",
         borderRadius: 14,          // ← arrondi sur les 4 coins
         overflow: "hidden",        // ← évite les débordements lors du swipe
         elevation: 2,              // (Android) léger relief
         shadowColor: "#000",       // (iOS) léger relief
         shadowOpacity: 0.15,
         shadowRadius: 6,
         shadowOffset: { width: 0, height: 2 },
       }}
     >
       <Ionicons name="trash-outline" size={22} color="#fff" />
       <Text style={{ color: "#fff", fontWeight: "800", marginTop: 4 }}>Delete</Text>
     </Pressable>
   </View>
  );

  const CardInner = (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textDark }}>
          {sitter?.name || "Babysitter"}
        </Text>
        <Badge label={item.status || "pending"} />
      </View>

      <Text style={{ marginTop: 6, color: colors.textLight }}>
        {fmtRange(item.startISO || item.startTime, item.endISO || item.endTime)}
      </Text>

      <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.textLight }}>
          Rate:{" "}
          <Text style={{ color: colors.textDark, fontWeight: "700" }}>
            ₪{item.rateSnapshot ?? sitter?.hourlyRate ?? 0}/h
          </Text>
        </Text>
        {(item.status === "pending" || item.status === "accepted") && (
          <Pressable
            onPress={() => onCancel(item)}
            style={{ backgroundColor: "#FFCDD2", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 }}
          >
            <Text style={{ color: "#B71C1C", fontWeight: "800" }}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ marginBottom: 12 }}>
      {canHide(item) ? (
        <Swipeable
          renderRightActions={renderRight}
          overshootRight={false}
          friction={2}
          rightThreshold={40}
        >
          {CardInner}
        </Swipeable>
      ) : (
        CardInner
      )}
    </View>
  );
}

export default function MyBookingScreen() {
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(null);

  // Fetch bookings with tolerant params (role=parent by default)
  const fetchList = useCallback(
    async (st = status) => {
      const params = { role: "parent" };
      if (st && st !== "all") params.status = st;
      const res = await api.get("/api/bookings", { params });
      const payload = res.data;
      return Array.isArray(payload) ? payload : payload?.data || [];
    },
    [status]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchList(status);
      setRows(list);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Failed to list bookings";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }, [fetchList, status]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const list = await fetchList(status);
      setRows(list);
    } finally {
      setRefreshing(false);
    }
  }, [fetchList, status]);

  const onCancel = useCallback((b) => {
    setPending(b);
    setConfirmOpen(true);
  }, []);

  const confirmCancel = useCallback(
    async () => {
      try {
        if (!pending?._id) return setConfirmOpen(false);
        await api.put(`/api/bookings/${pending._id}/cancel`);
        emit("bookings:changed");
        setConfirmOpen(false);
        setPending(null);
        await load();
      } catch (e) {
        setConfirmOpen(false);
        const msg = e?.response?.data?.error || e.message || "Failed to cancel booking";
        Alert.alert("Error", msg);
      }
    },
    [pending, load]
  );

  const onHide = useCallback(
    async (b) => {
      try {
        // optimistic remove
        setRows((prev) => prev.filter((x) => x._id !== b._id));
        emit("bookings:changed");
        await hideBookingById(b._id);
        // re-sync (no await required)
        load();
      } catch (e) {
        await load();
        const msg = e?.response?.data?.error || e.message || "Failed to remove booking";
        Alert.alert("Error", msg);
      }
    },
    [load]
  );

  const Tabs = useMemo(
    () => (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {STATUS.map((opt) => {
          const active = status === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setStatus(opt)}
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
                {opt[0].toUpperCase() + opt.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [status]
  );

  return (
    <Screen edges={['top']}>
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textDark }}>My Bookings</Text>
      <Text style={{ marginTop: 6, color: colors.textLight }}>
        View and manage your requests. Payment is done on-site.
      </Text>

      <View style={{ height: 12 }} />
      {Tabs}

      {loading ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: colors.textLight }}>Loading…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View
          style={{
            marginTop: 24,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text style={{ color: colors.textDark, fontWeight: "700" }}>No bookings yet</Text>
          <Text style={{ color: colors.textLight, marginTop: 4 }}>
            When you send a request to a babysitter, it will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it._id}
          renderItem={({ item }) => <Row item={item} onCancel={onCancel} onHide={onHide} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <ConfirmModal
        visible={confirmOpen}
        title="Cancel booking"
        message={
          pending
            ? `Are you sure you want to cancel this booking?\n\n${fmtRange(
                pending.startISO || pending.startTime,
                pending.endISO || pending.endTime
              )}`
            : ""
        }
        confirmText="Yes, cancel"
        cancelText="No"
        onConfirm={confirmCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
    </Screen>
  );
}
