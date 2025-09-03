// screens/Auth/ParentStep3.jsx
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

export default function ParentStep3() {
  const navigation = useNavigation();
  const route = useRoute();

  // --- Controlled textarea
  const [needs, setNeeds] = useState(route.params?.needs || '');

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
      warn: '#B26A00',
    }),
    []
  );

  // --- Simple validation: require some content
  const canNext = useMemo(() => needs.trim().length > 0, [needs]);

  const onNext = () => {
    if (!canNext) {
      Alert.alert('Missing info', 'Please describe any special needs (allergies, routines, etc.).');
      return;
    }
    navigation.navigate('ParentStep4', { ...route.params, needs: needs.trim() });
  };

  const goBack = () => {
    navigation.navigate('ParentStep2', { ...route.params, needs });
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
            <Text style={[styles.h1, { color: THEME.text }]}>Special needs</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>
              Step  · Allergies, routines & specific care
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            {/* Text area */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Details</Text>
              <TextInput
                placeholder="Allergies (e.g., peanuts), dietary restrictions (kosher level), nap routines, medications, pickup/drop-off notes…"
                value={needs}
                onChangeText={setNeeds}
                multiline
                textAlignVertical="top"
                style={[
                  styles.textarea,
                  { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                ]}
                placeholderTextColor="#A8B3C2"
                returnKeyType="default"
              />
              <Text style={{ color: THEME.textMuted, fontSize: 11, marginTop: 6 }}>
                Provide anything babysitters should know in advance.
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

  // Inputs
  textarea: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 16,
    lineHeight: 22,
  },

  // CTA
  cta: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // Links
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkText: { fontSize: 14, fontWeight: '700' },
});
