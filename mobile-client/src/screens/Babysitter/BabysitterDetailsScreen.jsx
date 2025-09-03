// All comments in English as requested.
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, Image, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../../theme/color";
import RatingStars from "../../components/RatingStars";
import Chip from "../../components/Chip";
import AvailabilityCalendarRN from "../../components/AvailabilityCalendarRN";
import BookingModal from "../../components/BookingModal";
import api from "../../api/client";                // axios instance
import { createBooking } from "../../api/bookingApi";
import { emit } from "../../contexts/EventBus";
import * as AuthHook from "../../hooks/useAuth";
const useAuth = AuthHook.useAuth || AuthHook.default;

export default function BabysitterDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};
  const { user } = (useAuth?.() ?? { user: null });

  // Accept both new and legacy param names from Search/other screens
  const initialSitter = params.sitter || params.babysitter || null;
  const sitterId =
    params.sitter?._id ||
    params.babysitter?._id ||
    params.sitterId ||
    params.babysitterId ||
    params.id ||
    null;

  const [babysitter, setBabysitter] = useState(initialSitter);
  const [loading, setLoading] = useState(!initialSitter);
  const [error, setError] = useState(null);

  // Fetch a babysitter by id only if the full object isn't provided
  useEffect(() => {
    let alive = true;
    async function loadById(id) {
      try {
        setLoading(true);
        const res = await api.get(`/api/babysitters/${id}`);
        const fresh = res?.data?.data ?? res?.data;
        if (alive) setBabysitter(fresh);
      } catch (e) {
        if (alive) setError(e?.response?.data?.error || e?.message || "Failed to load babysitter.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (!babysitter && sitterId) loadById(sitterId);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitterId]);

  // Calendar state
  const [selectedDate, setSelectedDate] = useState(null);   // 'YYYY-MM-DD'
  const [availableSlots, setAvailableSlots] = useState([]); // optional: ['09:00-12:00', ...]
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const infoRows = useMemo(
    () => [
      { label: "Location", value: babysitter?.address || babysitter?.city || "—" },
      { label: "Experience", value: babysitter?.experience || "—" },
      { label: "Hourly rate", value: babysitter?.hourlyRate != null ? `${babysitter.hourlyRate} ₪/h` : "—" },
    ],
    [babysitter]
  );

  const handleDateSelect = useCallback((dateKey, slots) => {
    setSelectedDate(dateKey);
    setAvailableSlots(slots || []);
    setSelectedSlot(null);
  }, []);

  const handleConfirmFromModal = useCallback(
    async ({ startTime, endTime }) => {
      // Always send booking to the correct babysitter id
      const targetId = babysitter?._id || sitterId;
      if (!targetId) {
        Alert.alert("Unavailable", "Sitter not found. Please go back and try again.");
        return;
      }
      try {
        setModalOpen(false);
        await createBooking({ babysitterId: targetId, startTime, endTime }); // posts to /api/bookings
        try { emit?.("bookings:changed"); } catch {}
        Alert.alert("Booking sent 🎉", "Your request is now pending confirmation.");
        try { navigation.navigate("ParentTabs", { screen: "Bookings" }); }
        catch { navigation.getParent?.()?.navigate?.("Bookings"); }
      } catch (err) {
        const msg = err?.response?.data?.error || err?.message || "Unknown error";
        Alert.alert("Booking failed", msg);
      }
    },
    [babysitter?._id, sitterId, navigation]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: colors.textLight }}>Loading sitter…</Text>
      </View>
    );
  }

  if (error || (!babysitter && !sitterId)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ color: colors.textDark, fontWeight: "700", marginBottom: 6 }}>Couldn’t load this profile</Text>
        <Text style={{ color: colors.textLight, textAlign: "center" }}>{error || "Try again from the search page."}</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 10 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // UI object (fallbacks if any field missing)
  const ui = babysitter || { name: "Babysitter", age: "—", hourlyRate: "—", address: "—", bio: "", certifications: [], availability: {}, ratingAvg: 0, ratingCount: 0, photoUrl: "" };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header photo */}
      <Image
        source={ui.photoUrl ? { uri: ui.photoUrl } : require("../../../assets/icon.png")}
        style={{ width: "100%", height: 260 }}
        resizeMode="cover"
      />

      <View
        style={{
          backgroundColor: colors.card,
          marginTop: -20,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 16,
          borderColor: colors.border,
          borderWidth: 1,
        }}
      >
        {/* Name + rating + rate */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.textDark }}>
              {ui.name} {ui.age ? `• ${ui.age}y` : ""}
            </Text>
            <View style={{ marginTop: 6 }}>
              <RatingStars rating={ui.ratingAvg || 0} count={ui.ratingCount || 0} />
            </View>
          </View>
          <View style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
            <Text style={{ fontWeight: "700", color: colors.textDark }}>
              {ui.hourlyRate !== "—" && ui.hourlyRate != null ? `${ui.hourlyRate} ₪/h` : "—"}
            </Text>
          </View>
        </View>

        {/* Bio */}
        {!!ui.bio && (
          <Text style={{ marginTop: 12, color: colors.textLight, lineHeight: 20 }}>
            {ui.bio}
          </Text>
        )}

        {/* Certifications */}
        {!!ui.certifications?.length && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontWeight: "700", marginBottom: 8, color: colors.textDark }}>Certifications</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {ui.certifications.map((c) => (<Chip key={String(c)} label={String(c)} />))}
            </View>
          </View>
        )}

        {/* Info list */}
        <View style={{ marginTop: 16 }}>
          {infoRows.map((row) => (
            <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomColor: colors.border, borderBottomWidth: 1 }}>
              <Text style={{ color: colors.textLight }}>{row.label}</Text>
              <Text style={{ color: colors.textDark, fontWeight: "600" }}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Availability calendar */}
        <View style={{ marginTop: 16 }}>
          <AvailabilityCalendarRN
            availability={ui.availability}
            weeks={6}
            onDateSelect={handleDateSelect}
            onDayPress={(d) => handleDateSelect(d?.dateString, [])}
          />
        </View>

        {/* (Optional) time-slot pills */}
        {selectedDate && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: colors.textDark, fontWeight: "700", marginBottom: 8 }}>
              {selectedDate} — pick a time slot
            </Text>
            {availableSlots.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {availableSlots.map((slot) => {
                  const active = selectedSlot === slot;
                  return (
                    <Pressable
                      key={slot}
                      onPress={() => setSelectedSlot(slot)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary : "#fff",
                        marginRight: 8,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : colors.textDark, fontWeight: "700" }}>
                        {slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color: colors.textLight }}>No available slots for this weekday.</Text>
            )}
          </View>
        )}

        {/* CTA (only for parents) */}
        {user?.role === "parent" && (
          <Pressable
            onPress={() => {
              if (!selectedDate) {
                Alert.alert("Select a date", "Please tap a date on the calendar first.");
                return;
              }
              setModalOpen(true);
            }}
            style={{
              marginTop: 20,
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
              {selectedSlot ? `Book ${selectedDate}` : "Choose time & book"}
            </Text>
          </Pressable>
        )}

        {/* Booking modal */}
        <BookingModal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          dateISO={selectedDate}
          sitter={ui}
          onConfirm={handleConfirmFromModal}
        />
      </View>
    </ScrollView>
  );
}
