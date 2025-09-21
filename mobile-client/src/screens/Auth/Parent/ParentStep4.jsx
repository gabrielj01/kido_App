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
 * ParentStep4
 * - Collect dietary restrictions and babysitter preferences.
 * - Adds structured prefs (gender + languages) while keeping backward compatibility with `sitterPreferences` text.
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

export default function ParentStep4() {
  const navigation = useNavigation();
  const route = useRoute();

  // --- Text fields (backward compatible with previous payload)
  const [dietary, setDietary] = useState(route.params?.dietaryRestrictions || '');
  const [prefs, setPrefs] = useState(route.params?.sitterPreferences || '');

  // --- Structured preferences (optional but nice UX)
  const [gender, setGender] = useState(route.params?.sitterGenderPreference || 'any'); // 'any' | 'female' | 'male'
  const [languages, setLanguages] = useState(
    Array.isArray(route.params?.sitterLanguages) ? route.params.sitterLanguages : []
  );

  // --- Theme (merged with optional external theme)
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
    }),
    []
  );

  // --- Simple rules: at least one of the fields should be filled/selected
  const canNext = useMemo(() => {
    const hasText = dietary.trim().length > 0 || prefs.trim().length > 0;
    const hasStructured = gender !== 'any' || languages.length > 0;
    return hasText || hasStructured;
  }, [dietary, prefs, gender, languages]);

  const toggleLang = (code) => {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const onNext = () => {
    navigation.navigate('Signup', {
      ...route.params,
      dietaryRestrictions: dietary.trim(),
      sitterPreferences: prefs.trim(),              // keeps backward compatibility
      sitterGenderPreference: gender,
      sitterLanguages: languages,
    });
  };

  const goBack = () => {
    navigation.navigate('ParentStep3', {
      ...route.params,
      dietaryRestrictions: dietary.trim(),
      sitterPreferences: prefs.trim(),
      sitterGenderPreference: gender,
      sitterLanguages: languages,
    });
  };

  // Suggested languages (Israel context)
  const LANGS = [
    { code: 'en', label: 'English' },
    { code: 'he', label: 'Hebrew' },
    { code: 'fr', label: 'French' },
    { code: 'ru', label: 'Russian' },
    { code: 'ar', label: 'Arabic' },
    { code: 'es', label: 'Spanish' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: THEME.bg }]}>
      {/* Decorative header blobs */}
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
            <Text style={[styles.h1, { color: THEME.text }]}>Diet & sitter preferences</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>
              Step · Dietary restrictions & babysitter preferences
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            {/* Dietary restrictions */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Dietary restrictions</Text>
              <TextInput
                placeholder="Kosher level, allergies (e.g., peanuts), no dairy/meat mix, etc."
                value={dietary}
                onChangeText={setDietary}
                multiline
                textAlignVertical="top"
                style={[
                  styles.textarea,
                  { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                ]}
                placeholderTextColor="#A8B3C2"
              />
            </View>

            {/* Babysitter gender preference (segmented) */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Preferred sitter gender</Text>
              <View style={styles.segmentWrap}>
                {['any', 'female', 'male'].map((opt) => {
                  const active = gender === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setGender(opt)}
                      style={[
                        styles.segmentBtn,
                        {
                          backgroundColor: active ? THEME.secondary : '#FFF',
                          borderColor: active ? THEME.secondary : THEME.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      {/* ✅ fixed stray quote after THEME.text */}
                      <Text style={{ color: active ? '#073B4C' : THEME.text, fontWeight: '700' }}>
                        {opt === 'any' ? 'Any' : opt === 'female' ? 'Female' : 'Male'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Languages (multi-select chips) */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Languages</Text>
              <View style={styles.chipsRow}>
                {LANGS.map((l) => {
                  const active = languages.includes(l.code);
                  return (
                    <Pressable
                      key={l.code}
                      onPress={() => toggleLang(l.code)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? THEME.secondary : '#FFF',
                          borderColor: active ? THEME.secondary : THEME.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={{ color: active ? '#073B4C' : THEME.text, fontWeight: '700' }}>
                        {l.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Free-text preferences (kept for backward compatibility) */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Other preferences</Text>
              <TextInput
                placeholder="Certifications, years of experience, smoker/non-smoker, pet-friendly, etc."
                value={prefs}
                onChangeText={setPrefs}
                multiline
                textAlignVertical="top"
                style={[
                  styles.textarea,
                  { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                ]}
                placeholderTextColor="#A8B3C2"
              />
              <Text style={{ color: THEME.textMuted, fontSize: 11, marginTop: 6 }}>
                Optional: add anything else important to you.
              </Text>
            </View>

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
              accessibilityLabel="Review & Continue"
            >
              <Text style={styles.ctaText}>Review & Continue</Text>
            </Pressable>

            <Pressable onPress={goBack} style={styles.linkBtn}>
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

  // Fields
  field: { marginBottom: 14 },
  label: { marginBottom: 8, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Inputs
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 16,
    lineHeight: 22,
  },

  // Segmented control
  segmentWrap: { flexDirection: 'row', gap: 10 },
  segmentBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  // CTA
  cta: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // Links
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkText: { fontSize: 14, fontWeight: '700' },
});
