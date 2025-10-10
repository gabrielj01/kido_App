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
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

// --- Robust theme import with safe fallbacks (tries two common paths)
let importedDefaultA, importedNSA;
try {
  importedDefaultA = require('../../../theme/colors').default;
  importedNSA = require('../../../theme/colors');
} catch (_) {
  importedDefaultA = null;
  importedNSA = {};
}
let importedDefaultB, importedNSB;
if (!importedDefaultA) {
  try {
    importedDefaultB = require('../../theme/colors').default;
    importedNSB = require('../../theme/colors');
  } catch (_) {
    importedDefaultB = null;
    importedNSB = {};
  }
}
const importedColors =
  importedNSA?.colors ||
  importedDefaultA ||
  importedNSA?.default ||
  importedNSB?.colors ||
  importedDefaultB ||
  importedNSB?.default ||
  null;

export default function ParentStep2() {
  const navigation = useNavigation();
  const route = useRoute();

  // --- Initial params from previous steps kept intact
  const baseParams = route?.params || {};

  // --- Controlled state for number of children and ages array
  const [numChildren, setNumChildren] = useState(
    Number.isFinite(Number(baseParams?.numChildren)) ? Number(baseParams?.numChildren) : 1
  );
  const [childrenAges, setChildrenAges] = useState(
    Array.isArray(baseParams?.childrenAges) && baseParams.childrenAges.length > 0
      ? baseParams.childrenAges.map(String)
      : ['']
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
  const clampInt = (v, min, max) => Math.max(min, Math.min(max, parseInt(String(v || '').replace(/[^\d]/g, '') || '0', 10)));
  const syncAgesLength = (n) => {
    setChildrenAges((prev) => {
      const next = [...prev];
      if (n > next.length) next.push(...Array(n - next.length).fill(''));
      else next.splice(n);
      return next;
    });
  };

  const onChangeNumInput = (txt) => {
    const n = clampInt(txt, 1, 10);
    setNumChildren(n);
    syncAgesLength(n);
  };

  const stepNum = (dir) => {
    const n = clampInt((numChildren || 1) + dir, 1, 10);
    setNumChildren(n);
    syncAgesLength(n);
  };

  const updateAge = (idx, val) => {
    setChildrenAges((prev) => {
      const next = [...prev];
      next[idx] = val.replace(/[^\d]/g, ''); // keep digits only
      return next;
    });
  };

  const isValidAge = (s) => {
    if (String(s).trim() === '') return false;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 && n <= 17; // simple rule of thumb
  };

  const canNext = useMemo(() => {
    const slice = childrenAges.slice(0, numChildren);
    return slice.every(isValidAge);
  }, [childrenAges, numChildren]);

  const onNext = () => {
    if (!canNext) {
      Alert.alert('Missing info', 'Please fill in all children ages (0–17).');
      return;
    }
    navigation.navigate('ParentStep3', {
      ...baseParams,
      numChildren,
      childrenAges: childrenAges.slice(0, numChildren).map((s) => Number(s)),
    });
  };

  const goBack = () => {
    navigation.navigate('SignupStep2', { ...baseParams });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: THEME.bg }]}>
      {/* Decorative header blobs (no extra deps) */}
      <View style={styles.headerWrap} pointerEvents="none">
        <View style={[styles.blob, { backgroundColor: THEME.primary, top: -70, left: -50, opacity: 0.18 }]} />
        <View style={[styles.blob, { backgroundColor: THEME.secondary, top: -10, right: -60, width: 220, height: 220, opacity: 0.22 }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.titleBox}>
            <Text style={[styles.h1, { color: THEME.text }]}>Children information</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>Step 4 · Children (count & ages)</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            {/* Number of children with stepper */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Number of children (1–10)</Text>
              <View style={styles.rowBetween}>
                <Pressable onPress={() => stepNum(-1)} style={[styles.stepBtn, { borderColor: THEME.border, backgroundColor: '#FFF' }]} accessibilityRole="button">
                  <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '800' }}>−</Text>
                </Pressable>

                <TextInput
                  value={String(numChildren)}
                  onChangeText={onChangeNumInput}
                  keyboardType="number-pad"
                  style={[
                    styles.input,
                    { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF', textAlign: 'center', flex: 1, marginHorizontal: 8 },
                  ]}
                  placeholderTextColor="#A8B3C2"
                />

                <Pressable onPress={() => stepNum(1)} style={[styles.stepBtn, { borderColor: THEME.border, backgroundColor: '#FFF' }]} accessibilityRole="button">
                  <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '800' }}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Dynamic ages */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Ages (years)</Text>
              {Array.from({ length: numChildren }).map((_, i) => (
                <View key={`age-${i}`} style={{ marginBottom: i === numChildren - 1 ? 0 : 10 }}>
                  <Text style={[styles.smallLabel, { color: THEME.textMuted }]}>Child {i + 1}</Text>
                  <TextInput
                    placeholder="e.g. 3"
                    keyboardType="number-pad"
                    value={String(childrenAges[i] ?? '')}
                    onChangeText={(t) => updateAge(i, t)}
                    style={[
                      styles.input,
                      { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                    ]}
                    placeholderTextColor="#A8B3C2"
                  />
                  {!isValidAge(childrenAges[i]) && String(childrenAges[i]).trim() !== '' ? (
                    <Text style={{ color: THEME.warn, fontSize: 12, marginTop: 4 }}>Please enter a value between 0 and 17.</Text>
                  ) : null}
                </View>
              ))}
            </View>

            {/* Helper */}
            <Text style={[styles.note, { color: THEME.textMuted, marginTop: 8 }]}>
              You can adjust ages later in your profile if needed.
            </Text>

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
  smallLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.3 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
  },

  // Stepper
  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CTA
  cta: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // Links & notes
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkText: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 16 },
});
