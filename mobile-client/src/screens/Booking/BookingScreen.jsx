import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Platform, Alert, ActivityIndicator, ToastAndroid } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRoute, useNavigation } from "@react-navigation/native";
import ConfirmModal from "../../components/ConfirmModal";
import api from "../../api/client"; // axios instance with auth interceptor
import { colors } from "../../theme/color";

/** Combine a date (any time) and a time-of-day into one Date in local TZ */
function combineDateAndTime(day, time) {
  const d = new Date(day);
  const t = new Date(time);
  const combined = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    t.getHours(),
    t.getMinutes(),
    0,
    0
  );
  combined.setSeconds(0, 0);
  return combined;
}

/** Add n days to a Date (returns a new Date) */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Parse "HH:MM - HH:MM" into {start,end} strings */
function parseSlot(slot) {
  if (!slot || typeof slot !== "string" || !slot.includes("-")) return { start: null, end: null };
  const [a, b] = slot.split("-").map((s) => s.trim());
  return { start: a || null, end: b || null };
}

/** Set time "HH:MM" on an existing Date (returns a new Date) */
function setTimeOn(dateObj, hhmm) {
  const d = new Date(dateObj);
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (Number.isFinite(h) && Number.isFinite(m)) d.setHours(h, m, 0, 0);
  return d;
}

export default function BookingScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  // Babysitter info provided from previous screen
  const { babysitter, date: preDateStr, slot: preSlot, startTime: preStartISO, endTime: preEndISO } = route.params || {};
  const sitterId = babysitter?._id || babysitter?.id;
  const sitterName = babysitter?.name || "Babysitter";
  const hourlyRate = babysitter?.hourlyRate ?? 0;

  // Base date (midnight)
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Default start/end: +1h / +2h from now
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    d.setSeconds(0, 0);
    return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 120);
    d.setSeconds(0, 0);
    return d;
  });

  // Prefill from params (date 'YYYY-MM-DD' + slot 'HH:MM - HH:MM' OR ISO times)
  useEffect(() => {
    if (preDateStr && /^\d{4}-\d{2}-\d{2}$/.test(preDateStr)) {
      const [y, m, d] = preDateStr.split("-").map(Number);
      setDate(new Date(y, m - 1, d, 0, 0, 0, 0));
    }
    if (preSlot) {
      const { start, end } = parseSlot(preSlot);
      if (start) setStartTime((t) => setTimeOn(t, start));
      if (end) setEndTime((t) => setTimeOn(t, end));
    }
    if (preStartISO && preEndISO) {
      // If ISO strings were passed (from another flow), take them directly
      const s = new Date(preStartISO);
      const e = new Date(preEndISO);
      setDate(new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0));
      setStartTime(s);
      setEndTime(e);
    }
  }, []);

  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Duration & price — handle overnight (end <= start means next day)
  const { durationHours, price } = useMemo(() => {
    const startDT = combineDateAndTime(date, startTime);
    let endDT = combineDateAndTime(date, endTime);
    if (endDT <= startDT) endDT = addDays(endDT, 1); // overnight case
    const ms = endDT - startDT;
    const hours = Math.max(0, ms / 3_600_000);
    const rounded = Math.round(hours * 4) / 4; // round to quarter-hour
    const p = Math.max(0, rounded * hourlyRate);
    return { durationHours: rounded, price: p };
  }, [date, startTime, endTime, hourlyRate]);

  /** Validate user input before confirmation */
  function validate() {
    const errs = [];
    const now = new Date();

    const dateOnly = new Date(date); dateOnly.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (dateOnly < today) errs.push("Selected date is in the past.");

    const startDT = combineDateAndTime(date, startTime);
    if (dateOnly.getTime() === today.getTime() && startDT <= now) {
      errs.push("Start time must be in the future.");
    }

    setErrors(errs);
    return errs.length === 0;
  }

  function onConfirmRequest() {
    if (!validate()) return;
    if (!sitterId) {
      setErrors((prev) => [...prev, "Missing babysitter id."]);
      return;
    }
    setShowConfirm(true);
  }

  // Android pickers handlers
  const onChangeDate = (_evt, selected) => {
    if (!selected) return;
    const d = new Date(selected);
    d.setHours(0, 0, 0, 0);
    setDate(d);
  };
  const onChangeStart = (_evt, selected) => {
    if (!selected) return;
    const base = new Date(startTime);
    const s = new Date(selected);
    base.setHours(s.getHours(), s.getMinutes(), 0, 0);
    setStartTime(new Date(base));
  };
  const onChangeEnd = (_evt, selected) => {
    if (!selected) return;
    const base = new Date(endTime);
    const e = new Date(selected);
    base.setHours(e.getHours(), e.getMinutes(), 0, 0);
    setEndTime(new Date(base));
  };

  // Summary for modal
  const summary = useMemo(() => {
    const fmtDate = date.toLocaleDateString();
    const fmt = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `Date: ${fmtDate}\nTime: ${fmt(startTime)} - ${fmt(endTime)}\nDuration: ${durationHours} h\nEstimated price: ${price.toFixed(2)} ₪ (on-site payment)`;
  }, [date, startTime, endTime, durationHours, price]);

  /** Call API to create booking */
  async function onConfirmBooking() {
    try {
      setSubmitting(true);
      const startDT = combineDateAndTime(date, startTime);
      let endDT = combineDateAndTime(date, endTime);
      if (endDT <= startDT) endDT = addDays(endDT, 1); // overnight

      const payload = {
        babysitterId: sitterId,            // server expects 'babysitterId'
        startTime: startDT.toISOString(),  // ISO in UTC
        endTime: endDT.toISOString(),
      };

      await api.post("/api/bookings", payload);
      setShowConfirm(false);

      if (Platform.OS === "android") {
        ToastAndroid.show("Booking confirmed", ToastAndroid.SHORT);
      } else {
        Alert.alert("Booking confirmed", "Your booking was created successfully.");
      }


      navigation.goBack();
    } catch (err) {
      setShowConfirm(false);
      const msg = err?.response?.data?.error || "Failed to create booking";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textDark }}>
        Booking — {sitterName}
      </Text>
      <Text style={{ marginTop: 6, color: colors.textLight }}>
        Choose date and time. Payment is on-site.
      </Text>

      {/* Date */}
      <View style={{ marginTop: 18 }}>
        <Text style={{ fontWeight: "700", color: colors.textDark }}>Date</Text>
        <View
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 8,
            backgroundColor: colors.card,
          }}
        >
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={onChangeDate}
          />
        </View>
      </View>

      {/* Time pickers */}
      <View style={{ marginTop: 18 }}>
        <Text style={{ fontWeight: "700", color: colors.textDark }}>Time range</Text>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8, backgroundColor: colors.card }}>
            <Text style={{ marginBottom: 6, color: colors.textLight }}>Start</Text>
            <DateTimePicker
              value={startTime}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onChangeStart}
              minuteInterval={15}
            />
          </View>

          <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8, backgroundColor: colors.card }}>
            <Text style={{ marginBottom: 6, color: colors.textLight }}>End</Text>
            <DateTimePicker
              value={endTime}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onChangeEnd}
              minuteInterval={15}
            />
          </View>
        </View>
      </View>

      {/* Estimate */}
      <View
        style={{
          marginTop: 18,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
        }}
      >
        <Text style={{ color: colors.textLight }}>
          Estimated duration:{" "}
          <Text style={{ color: colors.textDark, fontWeight: "700" }}>
            {durationHours} h
          </Text>
        </Text>
        <Text style={{ color: colors.textLight, marginTop: 4 }}>
          Rate:{" "}
          <Text style={{ color: colors.textDark, fontWeight: "700" }}>
            {hourlyRate} ₪/h
          </Text>
        </Text>
        <Text style={{ color: colors.textLight, marginTop: 4 }}>
          Estimated price:{" "}
          <Text style={{ color: colors.textDark, fontWeight: "800" }}>
            {price.toFixed(2)} ₪
          </Text>
        </Text>

        {submitting && (
          <View style={{ marginTop: 10, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 6, color: colors.textLight }}>Creating booking…</Text>
          </View>
        )}
      </View>

      {/* Errors */}
      {!!errors.length && (
        <View
          style={{
            marginTop: 12,
            backgroundColor: "#FFF3CD",
            borderColor: "#FFEEBA",
            borderWidth: 1,
            borderRadius: 10,
            padding: 10,
          }}
        >
          {errors.map((e, idx) => (
            <Text key={idx} style={{ color: "#856404" }}>
              {e}
            </Text>
          ))}
        </View>
      )}

      {/* CTA */}
      <Pressable
        onPress={onConfirmRequest}
        style={{
          marginTop: 16,
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: "center",
          opacity: submitting ? 0.7 : 1,
        }}
        disabled={submitting}
      >
        <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>Continue</Text>
      </Pressable>

      {/* Confirmation modal */}
      <ConfirmModal
        visible={showConfirm}
        title="Confirm booking"
        message={summary}
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={onConfirmBooking}
        onCancel={() => setShowConfirm(false)}
      />
    </View>
  );
}
