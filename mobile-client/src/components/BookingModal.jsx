import React, { useMemo, useState } from "react";
import { View, Text, Modal, Pressable, FlatList, Alert } from "react-native";
import dayjs from "dayjs";

/** Build half-hour slots from 07:00 to 23:00 */
const buildSlots = (start = 7, end = 23, stepMin = 30) => {
  const out = [];
  for (let h = start; h <= end; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      out.push(`${hh}:${mm}`);
    }
  }
  return out;
};

/** Safer ISO builder: parse local date components and construct Date(y,m-1,d,hh,mm) */
function toISOFromLocal(dateStr, hhmm) {
  if (!dateStr || !hhmm) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const dt = new Date(y, (m || 1) - 1, d, hh, mm, 0, 0); // Local time
  return dt.toISOString(); // UTC ISO string for the server
}

export default function BookingModal({ visible, onClose, dateISO, sitter, onConfirm }) {
  // dateISO like "2025-08-20"
  const slots = useMemo(() => buildSlots(), []);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);

  const handleConfirm = () => {
    if (!start || !end) return Alert.alert("Missing time", "Please select start and end time.");
    if (end <= start) return Alert.alert("Invalid range", "End must be after start.");

    const startTime = toISOFromLocal(dateISO, start);
    const endTime = toISOFromLocal(dateISO, end);
    if (!startTime || !endTime) return Alert.alert("Invalid date", "Could not build ISO time.");

    onConfirm({ startTime, endTime });
  };

  const Item = ({ label, selected, onPress }) => (
    <Pressable
      onPress={onPress}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        margin: 4,
        backgroundColor: selected ? "#FFE082" : "white",
        borderColor: selected ? "#FFB300" : "#CFD8DC",
      }}
    >
      <Text style={{ fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: "#FFF", padding: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
            Select time on {dayjs(dateISO).format("ddd, MMM D")}
          </Text>
          <Text style={{ marginBottom: 8 }}>
            Sitter: {sitter?.name} • Rate: ₪{sitter?.hourlyRate || 0}/h
          </Text>

          <Text style={{ fontWeight: "600", marginTop: 6 }}>Start</Text>
          <FlatList
            data={slots}
            keyExtractor={(it) => `s-${it}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Item label={item} selected={start === item} onPress={() => setStart(item)} />
            )}
            style={{ marginBottom: 8 }}
          />

          <Text style={{ fontWeight: "600", marginTop: 6 }}>End</Text>
          <FlatList
            data={slots}
            keyExtractor={(it) => `e-${it}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Item label={item} selected={end === item} onPress={() => setEnd(item)} />
            )}
            style={{ marginBottom: 16 }}
          />

          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Pressable onPress={onClose} style={{ padding: 14, flex: 1, borderRadius: 12, backgroundColor: "#ECEFF1" }}>
              <Text style={{ textAlign: "center", fontWeight: "700" }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} style={{ padding: 14, flex: 1, borderRadius: 12, backgroundColor: "#FFB300" }}>
              <Text style={{ textAlign: "center", fontWeight: "700", color: "#212121" }}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
