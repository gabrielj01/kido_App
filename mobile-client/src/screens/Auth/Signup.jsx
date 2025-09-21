// screens/Auth/Signup.jsx
import React, { useContext, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { AuthContext } from '../../contexts/AuthContext';


// --- Optional theme import with safe fallback to ensure screen never crashes
let modAdef, modAns;
try { modAdef = require('../../theme/colors').default; modAns = require('../../theme/colors'); } catch (_) {}
const importedColors = modAns?.colors || modAdef || modAns?.default || null;

// Language label map for nicer display
const LANGUAGE_LABELS = {
  en: 'English',
  he: 'Hebrew',
  fr: 'French',
  ru: 'Russian',
  ar: 'Arabic',
  es: 'Spanish',
};

export default function Signup({ navigation }) {
  const route = useRoute();
  const { signup } = useContext(AuthContext);
  const [submitting, setSubmitting] = useState(false);

  // --- THEME
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

  // --- Extract + normalize params coming from previous steps
  const p = route?.params || {};
  const role = p?.role || 'parent';
  const address = p?.addressData?.address ?? p?.address ?? '';
  const latitude = p?.addressData?.latitude ?? p?.latitude ?? null;
  const longitude = p?.addressData?.longitude ?? p?.longitude ?? null;

  // Parent-specific
  const numChildren = p?.numChildren;
  const childrenAges = Array.isArray(p?.childrenAges) ? p.childrenAges : undefined;
  const needs = p?.needs;
  const dietaryRestrictions = p?.dietaryRestrictions;
  const sitterPreferences = p?.sitterPreferences;
  const sitterGenderPreference = p?.sitterGenderPreference; // 'any' | 'female' | 'male'
  const sitterLanguages = Array.isArray(p?.sitterLanguages) ? p.sitterLanguages : undefined;

  // Sitter-specific
  const hourlyRate = p?.hourlyRate;
  const certifications = Array.isArray(p?.certifications) ? p.certifications : p?.certifications;
  const experience = Array.isArray(p?.experience) ? p.experience : p?.experience;
  const bio = p?.bio;
  const age = p?.age;
  const photoUrl = p?.photoUrl;

  // --- Helpers
  const toReadable = (v) => {
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };
  const formatLanguages = (arr) =>
    Array.isArray(arr) && arr.length > 0 ? arr.map((c) => LANGUAGE_LABELS[c] || c).join(', ') : '';

  const fmtGender = (g) =>
    g === 'female' ? 'Female' : g === 'male' ? 'Male' : g === 'any' ? 'Any' : toReadable(g);

  // --- Build review sections dynamically (only show existing values)
  const commonRows = [
    { label: 'Name', value: p?.name },
    { label: 'Email', value: (p?.email || '').toLowerCase() },
    p?.username ? { label: 'Username', value: String(p.username).toLowerCase() } : null,
    { label: 'Role', value: role },
    address ? { label: 'Address', value: address } : null,
  ].filter(Boolean);

  const parentRows =
    role === 'parent'
      ? [
          Number.isFinite(Number(numChildren)) ? { label: 'Number of children', value: String(numChildren) } : null,
          Array.isArray(childrenAges) && childrenAges.length
            ? { label: 'Age(s) of each children ', value: childrenAges.join(', ') }
            : null,
          needs ? { label: 'Special needs', value: needs } : null,
          dietaryRestrictions ? { label: 'Dietary restrictions', value: dietaryRestrictions } : null,
          sitterPreferences ? { label: 'Other preferences', value: sitterPreferences } : null,
          sitterGenderPreference
            ? { label: 'Preferred sitter gender', value: fmtGender(sitterGenderPreference) }
            : null,
          sitterLanguages && sitterLanguages.length
            ? { label: 'Preferred languages', value: formatLanguages(sitterLanguages) }
            : null,
        ].filter(Boolean)
      : [];

  const sitterRows =
    role === 'babysitter'
      ? [
          Number.isFinite(Number(hourlyRate)) ? { label: 'Hourly rate (₪/h)', value: String(hourlyRate) } : null,
          certifications ? { label: 'Certifications', value: toReadable(certifications) } : null,
          experience ? { label: 'Experience', value: toReadable(experience) } : null,
          age ? { label: 'Age', value: String(age) } : null,
          bio ? { label: 'Bio', value: bio } : null,
          photoUrl ? { label: 'Photo URL', value: String(photoUrl) } : null,
        ].filter(Boolean)
      : [];

  // --- Small utility to render a section
  const Section = ({ title, rows, onEdit }) => {
    if (!rows || rows.length === 0) return null;
    return (
      <View style={[styles.section, { borderColor: THEME.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: THEME.text }]}>{title}</Text>
          {onEdit ? (
            <Pressable onPress={onEdit} style={styles.editBtn} accessibilityRole="button">
              <Text style={[styles.editText, { color: THEME.secondary }]}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
        {rows.map((r, idx) => (
          <View
            key={`${title}-${r.label}`}
            style={[
              styles.row,
              idx !== rows.length - 1 && { borderBottomColor: THEME.border, borderBottomWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text style={[styles.rowLabel, { color: THEME.textMuted }]}>{r.label}</Text>
            <Text style={[styles.rowValue, { color: THEME.text }]} numberOfLines={3}>
              {r.value}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // --- Build clean payload (strip undefined/null)
  const rawPayload = {
    name: p?.name,
    email: (p?.email || '').toLowerCase(),
    username: p?.username ? String(p.username).toLowerCase() : undefined,
    password: p?.password,
    role,
    address,
    latitude,
    longitude,
    // sitter
    hourlyRate: role === 'babysitter' ? Number(hourlyRate) : undefined,
    certifications,
    experience,
    age,
    bio,
    photoUrl,
    // parent
    numChildren,
    childrenAges,
    needs,
    dietaryRestrictions,
    sitterPreferences,
    sitterGenderPreference,
    sitterLanguages,
  };
  const payload = Object.keys(rawPayload).reduce((acc, k) => {
    const v = rawPayload[k];
    if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')) {
      acc[k] = v;
    }
    return acc;
  }, {});

  // --- Actions
  const onSubmit = async () => {
    try {
      setSubmitting(true);
      await signup(payload); // AuthContext should switch stacks on success
      Alert.alert('Welcome!', 'Your account has been created.');
    } catch (err) {
      const status = err?.response?.status;
      const field = err?.response?.data?.field;
      const code = err?.response?.data?.error;

      if (status === 409 && code === 'already_exists') {
        if (field === 'email') {
          Alert.alert('Email already used', 'Please choose another email address.');
          return;
        }
        if (field === 'username') {
          Alert.alert('Username already taken', 'Please choose another username.');
          return;
        }
      }
      const msg = err?.response?.data?.error || err?.message || 'Signup failed';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Edit shortcuts (navigate back with existing params)
  const editBasic = () => navigation.navigate('SignupStep1', { ...route.params });
  const editAddress = () => navigation.navigate('SignupStep2', { ...route.params });
  const editParentChildren = () => navigation.navigate('ParentStep2', { ...route.params });
  const editParentNeeds = () => navigation.navigate('ParentStep3', { ...route.params });
  const editParentPrefs = () => navigation.navigate('ParentStep4', { ...route.params });
  // Optional sitter edits if these routes exist in your navigator:
  const editSitterAbout = () => navigation.navigate?.('SitterStep2', { ...route.params });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: THEME.bg }]}>
      {/* Decorative colorful header blobs (no extra dependency) */}
      <View style={styles.headerWrap} pointerEvents="none">
        <View style={[styles.blob, { backgroundColor: THEME.primary, top: -70, left: -50, opacity: 0.18 }]} />
        <View style={[styles.blob, { backgroundColor: THEME.secondary, top: -10, right: -60, width: 220, height: 220, opacity: 0.22 }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.titleBox}>
            <Text style={[styles.h1, { color: THEME.text }]}>Review & Create Account</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>
              Double-check your information before creating your account.
            </Text>
          </View>

          {/* Card with sections */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            <Section title="Basic information" rows={commonRows} onEdit={editBasic} />
            <Section title="Address" rows={address ? [{ label: 'Address', value: address }] : []} onEdit={editAddress} />

            {role === 'parent' ? (
              <>
                <Section title="Children" rows={parentRows.slice(0, 2)} onEdit={editParentChildren} />
                <Section title="Special needs" rows={needs ? [{ label: 'Details', value: needs }] : []} onEdit={editParentNeeds} />
                <Section
                  title="Diet & sitter preferences"
                  rows={parentRows.slice(2)} // dietary, sitter prefs, gender, langs
                  onEdit={editParentPrefs}
                />
              </>
            ) : null}

            {role === 'babysitter' ? (
              <Section title="Sitter profile" rows={sitterRows} onEdit={editSitterAbout} />
            ) : null}

            {/* Helper footnote */}
            <Text style={[styles.note, { color: THEME.textMuted, marginTop: 12 }]}>
              Payments happen in person. No online payments required.
            </Text>

            {/* Actions */}
            <View style={{ height: 14 }} />
            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: submitting ? '#FFB39F' : THEME.primary, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Create my account"
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Create my account</Text>}
            </Pressable>

            {/* Global edit shortcut */}
            <Pressable onPress={editBasic} style={styles.linkBtn} accessibilityRole="button" accessibilityLabel="Back to edit">
              <Text style={[styles.linkText, { color: THEME.secondary }]}>Back to edit</Text>
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

  // Card + sections
  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  section: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#FFF',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  editText: { fontSize: 12, fontWeight: '800' },

  // Rows
  row: { paddingVertical: 10 },
  rowLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  rowValue: { marginTop: 4, fontSize: 16, fontWeight: '600' },

  // CTA & links
  cta: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkText: { fontSize: 14, fontWeight: '700' },

  // Notes
  note: { fontSize: 12, lineHeight: 16 },
});
