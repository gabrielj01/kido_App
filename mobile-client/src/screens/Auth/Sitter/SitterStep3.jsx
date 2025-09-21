import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

/**
 * SitterStep3
 * - Collect a structured list of experience entries: { type, years }.
 * - Validates that each row has a non-empty "type" and positive "years".
 * - Builds a readable string for the MVP backend (e.g. "Infants (2 yrs), Twins (1 yr)").
 * - Navigation:
 *    Back -> SitterStep2 (preserving params)
 *    Next -> SitterStep4 (passing experienceList + flattened 'experience' string)
 */

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

export default function SitterStep3() {
  const navigation = useNavigation();
  const route = useRoute();

  // --- Prefill from route if user navigated back here
  const [experienceList, setExperienceList] = useState(
    Array.isArray(route.params?.experienceList) && route.params.experienceList.length > 0
      ? route.params.experienceList.map((e) => ({ type: e.type || '', years: String(e.years || '') }))
      : [{ type: '', years: '' }]
  );

  // --- Theme (merge with optional external theme)
  const THEME = useMemo(
    () => ({
      primary: importedColors?.primary ?? '#FF7A59',    // playful orange
      secondary: importedColors?.secondary ?? '#4ECDC4',// teal accent
      bg: importedColors?.bg ?? '#F7F9FC',
      card: importedColors?.card ?? '#FFFFFF',
      text: importedColors?.textDark ?? '#1F2D3D',
      textMuted: importedColors?.textLight ?? '#6B7A90',
      border: importedColors?.border ?? '#E6ECF2',
      danger: importedColors?.danger ?? '#E63946',
      warn: '#B26A00',
    }),
    []
  );

  // --- Helpers
  const onlyInt = (t) => t.replace(/[^\d]/g, '');

  const updateExp = (i, field, val) => {
    setExperienceList((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: field === 'years' ? onlyInt(val) : val };
      return next;
    });
  };

  const addLine = () => setExperienceList((arr) => [...arr, { type: '', years: '' }]);

  const removeLine = (idx) =>
    setExperienceList((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));

  // --- Validation (MVP: each row needs type + years > 0)
  const canNext = useMemo(
    () =>
      experienceList.length > 0 &&
      experienceList.every((e) => e.type.trim().length > 0 && Number(onlyInt(e.years)) > 0),
    [experienceList]
  );

  const onNext = () => {
    const expStr = experienceList
      .map((e) => `${e.type.trim()} (${Number(onlyInt(e.years))} yr${Number(onlyInt(e.years)) > 1 ? 's' : ''})`)
      .join(', ');

    navigation.navigate('SitterStep4', {
      ...route.params,
      experienceList: experienceList.map((e) => ({ type: e.type.trim(), years: Number(onlyInt(e.years)) })),
      experience: expStr, // flat string for MVP backend
    });
  };

  const goBack = () => {
    navigation.navigate('SitterStep2', {
      ...route.params,
      experienceList,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: THEME.bg }]}>
      {/* Decorative header blobs (no extra deps) */}
      <View style={styles.headerWrap} pointerEvents="none">
        <View style={[styles.blob, { backgroundColor: THEME.primary, top: -70, left: -50, opacity: 0.18 }]} />
        <View style={[styles.blob, { backgroundColor: THEME.secondary, top: -10, right: -60, width: 220, height: 220, opacity: 0.22 }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={styles.titleBox}>
            <Text style={[styles.h1, { color: THEME.text }]}>Experience</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>
              Add the types of care you provided and for how many years.
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            {/* Dynamic rows */}
            {experienceList.map((e, i) => (
              <View
                key={`exp-${i}`}
                style={[
                  styles.rowCard,
                  { borderColor: THEME.border, backgroundColor: '#FFF' },
                  i !== experienceList.length - 1 && { marginBottom: 10 },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.smallLabel, { color: THEME.textMuted }]}>Experience #{i + 1}</Text>
                  {experienceList.length > 1 ? (
                    <Pressable onPress={() => removeLine(i)} style={styles.removeBtn} accessibilityRole="button">
                      <Text style={{ color: THEME.danger, fontWeight: '800' }}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: THEME.textMuted }]}>Type of care</Text>
                  <TextInput
                    placeholder="e.g., Infants, Twins, Special needs"
                    value={e.type}
                    onChangeText={(t) => updateExp(i, 'type', t)}
                    placeholderTextColor="#A8B3C2"
                    style={[
                      styles.input,
                      { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                    ]}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: THEME.textMuted }]}>Years of experience</Text>
                  <TextInput
                    placeholder="e.g., 2"
                    value={e.years}
                    onChangeText={(t) => updateExp(i, 'years', t)}
                    keyboardType="number-pad"
                    placeholderTextColor="#A8B3C2"
                    style={[
                      styles.input,
                      { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                    ]}
                    returnKeyType="done"
                  />
                  {e.type.trim().length > 0 && !(Number(onlyInt(e.years)) > 0) ? (
                    <Text style={{ color: THEME.warn, fontSize: 12, marginTop: 6 }}>
                      Please enter a positive number of years.
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}

            {/* Add experience */}
            <Pressable onPress={addLine} style={styles.linkBtn} accessibilityRole="button">
              <Text style={[styles.linkText, { color: THEME.secondary }]}>+ Add experience</Text>
            </Pressable>

            {/* Actions */}
            <View style={{ height: 12 }} />
            <Pressable
              onPress={onNext}
              disabled={!canNext}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: !canNext ? '#FFB39F' : THEME.primary, transform: [{ scale: pressed && canNext ? 0.98 : 1 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Text style={styles.ctaText}>Next</Text>
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
  blob: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 120,
    transform: [{ rotate: '10deg' }],
  },

  // Typography
  titleBox: { paddingHorizontal: 24, marginBottom: 12, marginTop: 12 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: 0.2 },
  sub: { marginTop: 6, fontSize: 14 },

  // Card
  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  // Sub-card for each experience item
  rowCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },

  // Fields
  field: { marginTop: 10 },
  label: { marginBottom: 8, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  smallLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Inputs
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
  },

  // CTA & links
  cta: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkText: { fontSize: 14, fontWeight: '700' },

  // Remove button inside item
  removeBtn: { paddingHorizontal: 6, paddingVertical: 4, marginLeft: 8 },
});
