// screens/Auth/SitterStep2.jsx
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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

/**
 * SitterStep2
 * - Collect babysitter age, hourly rate, and work area radius.
 * - Clean numeric inputs, basic validation, and navigate to SitterStep3.
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

export default function SitterStep2() {
  const navigation = useNavigation();
  const route = useRoute();

  // --- Prefill from previous steps if available
  const [age, setAge] = useState(route.params?.age ? String(route.params.age) : '');
  const [hourlyRate, setHourlyRate] = useState(
    route.params?.hourlyRate ? String(route.params.hourlyRate) : ''
  );
  const [workArea, setWorkArea] = useState(
    route.params?.workArea ? String(route.params.workArea) : ''
  );
  const [submitting, setSubmitting] = useState(false);

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

  // --- Validation rules (simple & forgiving for MVP)
  const canNext = useMemo(() => {
    const a = parseInt(age || '0', 10);
    const r = parseFloat(hourlyRate || '0');
    const w = parseFloat(workArea || '0');
    // Minimal constraints; adjust later if product requires (e.g., age >= 16)
    return Number.isFinite(a) && a > 0 && Number.isFinite(r) && r > 0 && Number.isFinite(w) && w > 0;
  }, [age, hourlyRate, workArea]);

  const onNext = async () => {
    try {
      if (!canNext) return;
      setSubmitting(true);
      navigation.navigate('SitterStep3', {
        ...route.params,
        age: parseInt(age, 10),
        hourlyRate: parseFloat(hourlyRate),
        workArea: parseFloat(workArea),
      });
    } catch (e) {
      Alert.alert('Error', e?.message || 'Unable to continue');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => navigation.navigate('SignupStep2', { ...route.params, age, hourlyRate, workArea });

  // --- Sanitizers
  const onlyInt = (t) => t.replace(/[^\d]/g, '');
  const onlyDecimal = (t) => t.replace(/[^\d.]/g, '');

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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.titleBox}>
            <Text style={[styles.h1, { color: THEME.text }]}>Pricing & Work Area</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>
              Set your age, hourly rate and how far you can travel.
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            {/* Age */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Age</Text>
              <TextInput
                placeholder="e.g., 20"
                value={age}
                onChangeText={(t) => setAge(onlyInt(t))}
                keyboardType="number-pad"
                placeholderTextColor="#A8B3C2"
                style={[styles.input, { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' }]}
                returnKeyType="next"
              />
              <Text style={{ color: THEME.textMuted, fontSize: 11, marginTop: 6 }}>
              </Text>
            </View>

            {/* Hourly Rate */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Hourly rate (₪/h)</Text>
              <TextInput
                placeholder="e.g., 45"
                value={hourlyRate}
                onChangeText={(t) => setHourlyRate(onlyDecimal(t))}
                keyboardType="decimal-pad"
                placeholderTextColor="#A8B3C2"
                style={[styles.input, { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' }]}
                returnKeyType="next"
              />
              <Text style={{ color: THEME.textMuted, fontSize: 11, marginTop: 6 }}>
                You can update your rate later from your profile.
              </Text>
            </View>

            {/* Work Area */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Work area (km radius)</Text>
              <TextInput
                placeholder="e.g., 5"
                value={workArea}
                onChangeText={(t) => setWorkArea(onlyDecimal(t))}
                keyboardType="decimal-pad"
                placeholderTextColor="#A8B3C2"
                style={[styles.input, { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' }]}
                returnKeyType="done"
              />
              <Text style={{ color: THEME.textMuted, fontSize: 11, marginTop: 6 }}>
                We use this radius to match families nearby (approximate distance).
              </Text>
            </View>

            {/* Actions */}
            <View style={{ height: 12 }} />
            <Pressable
              onPress={onNext}
              disabled={!canNext || submitting}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: !canNext || submitting ? '#FFB39F' : THEME.primary,
                  transform: [{ scale: pressed && canNext && !submitting ? 0.98 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Next</Text>}
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

  // Fields
  field: { marginBottom: 14 },
  label: { marginBottom: 8, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
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
});
