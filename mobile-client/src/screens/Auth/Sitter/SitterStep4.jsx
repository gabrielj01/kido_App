// screens/Auth/SitterStep4.jsx
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

/**
 * SitterStep4 (v2.3)
 * - Per-day toggle with Start/End (24h) shown ONLY when day is enabled.
 * - Quick presets:
 *    - If no day enabled → enable ALL days + apply preset.
 *    - Else → apply to enabled days only.
 * - "Select all" now means **24/7**:
 *    - On press → enable ALL days with 00:00–23:59.
 *    - Button turns orange only when every day is 00:00–23:59.
 * - Output: [{ day, hours: "HH:MM - HH:MM" }]
 */

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const PRESETS = {
  Morning: ['08:00','12:00'],
  Afternoon: ['12:00','16:00'],
  Evening: ['16:00','20:00'],
  Night: ['20:00','23:59'],
};

// --- Robust theme import with safe fallbacks (supports theme/colors or theme/color)
let modAdef, modAns, modBdef, modBns, modCdef, modCns, modDdef, modDns;
try { modAdef = require('../../../theme/colors').default; modAns = require('../../../theme/colors'); } catch (_) {}
try { modBdef = require('../../theme/colors')?.default; modBns = require('../../theme/colors'); } catch (_) {}
try { modCdef = require('../../../theme/color')?.default; modCns = require('../../../theme/color'); } catch (_) {}
try { modDdef = require('../../theme/color')?.default; modDns = require('../../theme/color'); } catch (_) {}

const importedColors =
  modAns?.colors || modAdef || modAns?.default ||
  modBns?.colors || modBdef || modBns?.default ||
  modCns?.colors || modCdef || modCns?.default ||
  modDns?.colors || modDdef || modDns?.default || null;

// --- Time helpers
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const timeToMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return NaN;
  const h = clamp(parseInt(m[1], 10), 0, 23);
  const mm = clamp(parseInt(m[2], 10), 0, 59);
  return h * 60 + mm;
};
const normalizeTime = (val) => {
  // Accept "8", "800", "08:0", etc → returns "HH:MM" clamped
  const digits = String(val || '').replace(/[^\d]/g, '').slice(0, 4);
  if (digits.length <= 2) {
    const h = clamp(parseInt(digits || '0', 10), 0, 23);
    return `${String(h).padStart(2, '0')}:00`;
  }
  const h = clamp(parseInt(digits.slice(0, 2), 10), 0, 23);
  const m = clamp(parseInt(digits.slice(2, 4).padEnd(2, '0'), 10), 0, 59);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const prettyInput = (val) => {
  const raw = String(val || '').replace(/[^\d]/g, '');
  if (raw.length <= 2) return raw;
  return `${raw.slice(0,2)}:${raw.slice(2,4)}`;
};

export default function SitterStep4() {
  const navigation = useNavigation();
  const route = useRoute();

  // --- Theme
  const THEME = useMemo(
    () => ({
      primary: importedColors?.primary ?? '#FF7A59',
      secondary: importedColors?.secondary ?? '#4ECDC4',
      bg: importedColors?.bg ?? '#F7F9FC',
      card: importedColors?.card ?? '#FFFFFF',
      text: importedColors?.textDark ?? '#1F2D3D',
      textMuted: importedColors?.textLight ?? '#6B7A90',
      border: importedColors?.border ?? '#E6ECF2',
      danger: importedColors?.danger ?? '#E63946',
    }),
    []
  );

  // --- State: { day: { enabled, start, end, _startRaw, _endRaw } }
  const [availability, setAvailability] = useState(() => {
    const fromRoute = Array.isArray(route.params?.availability) ? route.params.availability : [];
    const init = {};
    DAYS.forEach((d) => {
      init[d] = { enabled: false, start: '08:00', end: '16:00', _startRaw: '08:00', _endRaw: '16:00' };
    });
    fromRoute.forEach(({ day, hours }) => {
      const m = /^\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*$/.exec(hours || '');
      if (day && m) {
        init[day] = { enabled: true, start: m[1], end: m[2], _startRaw: m[1], _endRaw: m[2] };
      }
    });
    return init;
  });

  const enabledDays = useMemo(() => DAYS.filter((d) => availability[d].enabled), [availability]);

  // ✅ h24 detection: all days enabled AND each day is 00:00–23:59
  const isAllDayEveryday = useMemo(
    () => DAYS.every((d) => availability[d].enabled && availability[d].start === '00:00' && availability[d].end === '23:59'),
    [availability]
  );

  const startRefs = useRef({});
  const endRefs = useRef({});

  // --- Mutators
  const toggleDay = (day) =>
    setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }));

  const setStartRaw = (day, v) =>
    setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], _startRaw: prettyInput(v) } }));

  const setEndRaw = (day, v) =>
    setAvailability((prev) => ({ ...prev, [day]: { ...prev[day], _endRaw: prettyInput(v) } }));

  const commitStart = (day) =>
    setAvailability((prev) => {
      const t = normalizeTime(prev[day]._startRaw);
      return { ...prev, [day]: { ...prev[day], start: t, _startRaw: t } };
    });

  const commitEnd = (day) =>
    setAvailability((prev) => {
      const t = normalizeTime(prev[day]._endRaw);
      return { ...prev, [day]: { ...prev[day], end: t, _endRaw: t } };
    });

  // Apply preset: if no enabled day, enable all & apply; else apply to enabled only
  const applyPreset = (start, end) =>
    setAvailability((prev) => {
      const next = { ...prev };
      const hasAnyEnabled = DAYS.some((d) => next[d].enabled);
      DAYS.forEach((d) => {
        if (!hasAnyEnabled) next[d].enabled = true;
        if (next[d].enabled) {
          next[d] = { ...next[d], start, end, _startRaw: start, _endRaw: end };
        }
      });
      return next;
    });

  // ✅ "Select all" now enforces 24/7
  const selectAll247 = () =>
    setAvailability((prev) => {
      const next = { ...prev };
      DAYS.forEach((d) => {
        next[d] = { ...next[d], enabled: true, start: '00:00', end: '23:59', _startRaw: '00:00', _endRaw: '23:59' };
      });
      return next;
    });

  const clearAll = () =>
    setAvailability((prev) => {
      const next = { ...prev };
      DAYS.forEach((d) => (next[d].enabled = false));
      return next;
    });

  // --- Validation
  const invalidDays = useMemo(
    () =>
      enabledDays.filter((d) => {
        const a = timeToMinutes(availability[d].start);
        const b = timeToMinutes(availability[d].end);
        return !(Number.isFinite(a) && Number.isFinite(b) && a < b);
      }),
    [enabledDays, availability]
  );
  const canNext = enabledDays.length > 0 && invalidDays.length === 0;

  // --- Derived: which preset (if any) is active across enabled days?
  const isPresetActive = (label) => {
    const [s, e] = PRESETS[label];
    return enabledDays.length > 0 && enabledDays.every((d) => availability[d].start === s && availability[d].end === e);
  };

  // --- Navigation
  const onNext = () => {
    if (!canNext) {
      Alert.alert('Invalid time', 'Please ensure each enabled day has Start < End (24h format).');
      return;
    }
    const formatted = enabledDays.map((d) => ({
      day: d,
      hours: `${availability[d].start} - ${availability[d].end}`,
    }));

    const availabilityStr = formatted.map((i) => `${i.day}: ${i.hours}`).join(' | ');
    const prevBio = route.params?.bio || '';
    const cleanedBio = prevBio.replace(/\n?Availability:.*$/m, '').trim();
    const bioMerged = cleanedBio
      ? `${cleanedBio}\nAvailability: ${availabilityStr}`
      : `Availability: ${availabilityStr}`;

    navigation.navigate('Signup', {
      ...route.params,
      availability: formatted,
      bio: bioMerged,
    });
  };

  const goBack = () => {
    const formatted = enabledDays.map((d) => ({ day: d, hours: `${availability[d].start} - ${availability[d].end}` }));
    navigation.navigate('SitterStep3', { ...route.params, availability: formatted });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: THEME.bg }]}>
      {/* Decorative header blobs */}
      <View style={styles.headerWrap} pointerEvents="none">
        <View style={[styles.blob, { backgroundColor: THEME.primary, top: -70, left: -50, opacity: 0.18 }]} />
        <View style={[styles.blob, { backgroundColor: THEME.secondary, top: -10, right: -60, width: 220, height: 220, opacity: 0.22 }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <View style={styles.titleBox}>
            <Text style={[styles.h1, { color: THEME.text }]}>Weekly Availability</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>
              Toggle each day and set your start/end times in 24h format.
            </Text>
          </View>

          {/* Bulk actions + Presets */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            <View style={styles.bulkRow}>
              {/* Select all = 24/7 (orange only when fully 24/7) */}
              <Pressable
                onPress={selectAll247}
                style={[
                  styles.bulkBtn,
                  { borderColor: isAllDayEveryday ? THEME.primary : THEME.border, backgroundColor: isAllDayEveryday ? THEME.primary : '#FFF', borderWidth: 1 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isAllDayEveryday }}
              >
                <Text style={[styles.bulkText, { color: isAllDayEveryday ? '#FFF' : THEME.text }]}>Select all (24/7)</Text>
              </Pressable>

              <Pressable
                onPress={clearAll}
                style={[styles.bulkBtn, { borderColor: THEME.border, backgroundColor: '#FFF', borderWidth: 1 }]}
                accessibilityRole="button"
              >
                <Text style={[styles.bulkText, { color: THEME.text }]}>Clear all</Text>
              </Pressable>
            </View>

            <Text style={[styles.smallLabel, { color: THEME.textMuted, marginTop: 4 }]}>Quick presets</Text>
            <View style={styles.chipsWrap}>
              {Object.entries(PRESETS).map(([label, [s, e]]) => {
                const active = isPresetActive(label);
                return (
                  <Pressable
                    key={label}
                    onPress={() => applyPreset(s, e)}
                    style={[
                      styles.chip,
                      { borderColor: active ? THEME.primary : THEME.border, backgroundColor: active ? THEME.primary : '#FFF' },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={{ color: active ? '#FFF' : THEME.text, fontWeight: '700' }}>
                      {label} {s}–{e}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Day rows */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text, marginTop: 12 }]}>
            {DAYS.map((d, idx) => {
              const enabled = availability[d].enabled;
              const er = enabled
                ? !(timeToMinutes(availability[d].start) < timeToMinutes(availability[d].end))
                : false;

              return (
                <View
                  key={d}
                  style={[
                    styles.dayRow,
                    { borderColor: THEME.border, backgroundColor: '#FFF' },
                    idx !== DAYS.length - 1 && { marginBottom: 10 },
                  ]}
                >
                  {/* Header: toggle + day */}
                  <Pressable onPress={() => toggleDay(d)} style={styles.dayHeader} accessibilityRole="button">
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: THEME.border, backgroundColor: enabled ? THEME.secondary : '#FFF' },
                      ]}
                    >
                      {enabled ? <Text style={{ color: '#073B4C', fontWeight: '800' }}>✓</Text> : null}
                    </View>
                    <Text style={[styles.dayLabel, { color: THEME.text }]}>{d}</Text>
                  </Pressable>

                  {/* Time inputs — ONLY when enabled */}
                  {enabled && (
                    <>
                      <View style={styles.timeRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.label, { color: THEME.textMuted }]}>Start</Text>
                          <TextInput
                            ref={(r) => (startRefs.current[d] = r)}
                            keyboardType="number-pad"
                            value={availability[d]._startRaw}
                            onChangeText={(t) => setStartRaw(d, t)}
                            onEndEditing={() => commitStart(d)}
                            placeholder="08:00"
                            placeholderTextColor="#A8B3C2"
                            style={[
                              styles.timeInput,
                              { borderColor: er ? THEME.danger : THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                            ]}
                            returnKeyType="next"
                            onSubmitEditing={() => endRefs.current[d]?.focus()}
                          />
                        </View>

                        <View style={{ width: 12 }} />

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.label, { color: THEME.textMuted }]}>End</Text>
                          <TextInput
                            ref={(r) => (endRefs.current[d] = r)}
                            keyboardType="number-pad"
                            value={availability[d]._endRaw}
                            onChangeText={(t) => setEndRaw(d, t)}
                            onEndEditing={() => commitEnd(d)}
                            placeholder="16:00"
                            placeholderTextColor="#A8B3C2"
                            style={[
                              styles.timeInput,
                              { borderColor: er ? THEME.danger : THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                            ]}
                            returnKeyType="done"
                          />
                        </View>
                      </View>

                      {er ? (
                        <Text style={{ color: THEME.danger, fontSize: 12, marginTop: 6 }}>
                          Please ensure Start is before End.
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              );
            })}
          </View>

          {/* Actions */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text, marginTop: 12 }]}>
            <Pressable
              onPress={onNext}
              disabled={!canNext}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: !canNext ? '#FFB39F' : THEME.primary, transform: [{ scale: pressed && canNext ? 0.98 : 1 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Review & Continue"
            >
              <Text style={styles.ctaText}>Review & Continue</Text>
            </Pressable>

            <Pressable onPress={goBack} style={styles.linkBtn} accessibilityRole="button" accessibilityLabel="Back to previous">
              <Text style={[styles.linkText, { color: THEME.secondary }]}>Back to previous</Text>
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

  // Decorative header
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 120, transform: [{ rotate: '10deg' }] },

  // Typography
  titleBox: { paddingHorizontal: 24, marginBottom: 12, marginTop: 12 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: 0.2 },
  sub: { marginTop: 6, fontSize: 14 },

  // Cards
  card: {
    marginHorizontal: 16, padding: 16, borderRadius: 20,
    shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },

  // Bulk actions
  bulkRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  bulkBtn: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bulkText: { fontWeight: '800' },

  // Chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },

  // Day row
  dayRow: { borderWidth: 1, borderRadius: 14, padding: 12 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dayLabel: { fontSize: 16, fontWeight: '800' },

  // Time inputs
  label: { marginBottom: 6, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  timeRow: { flexDirection: 'row' },
  timeInput: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16 },

  // CTA & links
  cta: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkText: { fontSize: 14, fontWeight: '700' },
});
