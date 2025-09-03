// mobile-client/src/screens/Babysitter/SitterRequestsScreen.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator, Alert } from "react-native";
import api from "../../api/client";
import ConfirmModal from "../../components/ConfirmModal";
import { colors } from "../../theme/color";
import { emit } from "../../contexts/EventBus";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Ionicons } from "@expo/vector-icons";
import { hideBookingById } from "../../api/bookingApi";

const FILTERS = ["pending", "accepted", "declined", "cancelled", "completed"];

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
  const same = s.toDateString() === e.toDateString();
  const d = s.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const t = (x) => x.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return same ? `${d} • ${t(s)}–${t(e)}` : `${d} ${t(s)} → ${e.toLocaleDateString()} ${t(e)}`;
}

/** Can the sitter hide this booking from their list? */
function canHide(item) {
  const status = item.status;
  const end = new Date(item.endISO || item.endTime || 0);
  const isPast = !Number.isNaN(end) && end < new Date();
  return ["cancelled", "declined", "completed"].includes(status) || isPast;
}

function Row({ item, onAccept, onDecline, onHide }) {
  const parent = typeof item.parentId === "object" ? item.parentId : null;

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
         borderRadius: 14,
         overflow: "hidden",
         elevation: 2,
         shadowColor: "#000",
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
    <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textDark }}>
          {parent?.name || "Parent"}
        </Text>
        <Badge label={item.status || "pending"} />
      </View>

      <Text style={{ marginTop: 6, color: colors.textLight }}>
        {fmtRange(item.startISO || item.startTime, item.endISO || item.endTime)}
      </Text>

      {item.status === "pending" && (
        <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => onAccept(item)}
            style={{ flex: 1, backgroundColor: "#C8E6C9", paddingVertical: 10, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#1B5E20", fontWeight: "800" }}>Accept</Text>
          </Pressable>
          <Pressable
            onPress={() => onDecline(item)}
            style={{ flex: 1, backgroundColor: "#FFCDD2", paddingVertical: 10, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#B71C1C", fontWeight: "800" }}>Decline</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ marginBottom: 12 }}>
      {canHide(item) ? (
        <Swipeable renderRightActions={renderRight} overshootRight={false} friction={2} rightThreshold={40}>
          {CardInner}
        </Swipeable>
      ) : (
        CardInner
      )}
    </View>
  );
}

export default function SitterRequestsScreen() {
  const [filter, setFilter] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [confirm, setConfirm] = useState({ open: false, item: null, action: null }); // 'accepted' | 'declined'

  const fetchList = useCallback(async (st) => {
    const params = { role: "sitter" };
    if (st) params.status = st;
    const res = await api.get("/api/bookings", { params });
    const payload = res.data;
    return Array.isArray(payload) ? payload : payload?.data || [];
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchList(filter);
      setRows(list);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Failed to load requests";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }, [fetchList, filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const list = await fetchList(filter);
      setRows(list);
    } finally {
      setRefreshing(false);
    }
  }, [fetchList, filter]);

  const onAccept = useCallback((item) => setConfirm({ open: true, item, action: "accepted" }), []);
  const onDecline = useCallback((item) => setConfirm({ open: true, item, action: "declined" }), []);

  const doDecision = useCallback(async () => {
    try {
      const { item, action } = confirm;
      if (!item?._id || !action) return setConfirm({ open: false, item: null, action: null });
      await api.patch(`/api/bookings/${item._id}/decision`, { decision: action });
      emit("bookings:changed");
      setConfirm({ open: false, item: null, action: null });
      await load();
    } catch (e) {
      setConfirm({ open: false, item: null, action: null });
      const msg = e?.response?.data?.error || e.message || "Failed to update booking";
      Alert.alert("Error", msg);
    }
  }, [confirm, load]);

  const onHide = useCallback(async (b) => {
    try {
      // optimistic remove
      setRows((prev) => prev.filter((x) => x._id !== b._id));
      emit("bookings:changed");
      await hideBookingById(b._id);
      load();
    } catch (e) {
      await load();
      const msg = e?.response?.data?.error || e.message || "Failed to remove booking";
      Alert.alert("Error", msg);
    }
  }, [load]);

  const Tabs = useMemo(() => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {FILTERS.map((opt) => {
        const active = filter === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => setFilter(opt)}
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
  ), [filter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textDark }}>Requests</Text>
      <Text style={{ marginTop: 6, color: colors.textLight }}>
        Review incoming bookings and accept or decline.
      </Text>

      <View style={{ height: 12 }} />
      {Tabs}

      {loading ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: colors.textLight }}>Loading…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={{
          marginTop: 24, backgroundColor: colors.card, borderColor: colors.border,
          borderWidth: 1, borderRadius: 12, padding: 14,
        }}>
          <Text style={{ color: colors.textDark, fontWeight: "700" }}>No requests</Text>
          <Text style={{ color: colors.textLight, marginTop: 4 }}>
            New booking requests will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it._id}
          renderItem={({ item }) => (
            <Row item={item} onAccept={onAccept} onDecline={onDecline} onHide={onHide} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <ConfirmModal
        visible={confirm.open}
        title={confirm.action === "accepted" ? "Accept request" : "Decline request"}
        message={
          confirm.item
            ? `Are you sure?\n\n${fmtRange(
                confirm.item.startISO || confirm.item.startTime,
                confirm.item.endISO || confirm.item.endTime
              )}`
            : ""
        }
        confirmText={confirm.action === "accepted" ? "Accept" : "Decline"}
        cancelText="Cancel"
        onConfirm={doDecision}
        onCancel={() => setConfirm({ open: false, item: null, action: null })}
      />
    </View>
  );
}
