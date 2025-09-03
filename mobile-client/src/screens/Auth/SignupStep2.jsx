// screens/Auth/SignupStep2.jsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../../config';

// --- Optional theme import with safe fallback (keeps screen robust if file missing)
let importedDefault, importedNS;
try {
  importedDefault = require('../../theme/colors').default;
  importedNS = require('../../theme/colors');
} catch (_) {
  importedDefault = null;
  importedNS = {};
}
const importedColors = importedNS?.colors || importedDefault || importedNS?.default || null;

export default function SignupStep2({ navigation, route }) {
  // --- Step1 base data (kept exactly like your previous flow)
  const { name, email, password, role = 'parent' } = route?.params || {};

  // --- Initial values from route if user went back/forward
  const initialAddress = route?.params?.addressData?.address ?? route?.params?.address ?? '';
  const initialLat = route?.params?.addressData?.latitude ?? route?.params?.latitude ?? null;
  const initialLng = route?.params?.addressData?.longitude ?? route?.params?.longitude ?? null;

  // --- Local state
  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState(initialLat);
  const [longitude, setLongitude] = useState(initialLng);
  const [hourlyRate, setHourlyRate] = useState(
    role === 'babysitter' ? String(route?.params?.hourlyRate ?? '') : ''
  );
  const [submitting, setSubmitting] = useState(false);

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

  const hasPlacesKey =
    typeof GOOGLE_PLACES_API_KEY === 'string' &&
    GOOGLE_PLACES_API_KEY.trim().length > 10;

  // --- Form validation
  const canNext = useMemo(() => {
    if (!address?.trim()) return false;
    if (role === 'babysitter') {
      const n = Number(hourlyRate);
      return Number.isFinite(n) && n > 0;
    }
    return true;
  }, [address, role, hourlyRate]);

  // --- Navigate to next step preserving payload
  const onNext = async () => {
    try {
      setSubmitting(true);
      const base = {
        name,
        email,
        password,
        role,
        addressData: {
          address: address?.trim(),
          latitude,
          longitude,
        },
        ...(role === 'babysitter' ? { hourlyRate: Number(hourlyRate) } : {}),
      };

      if (!latitude || !longitude) {
        // Soft warning only; we still allow manual addresses for MVP
        console.log('No lat/lng set — continuing with typed address only.');
      }

      navigation.navigate(role === 'parent' ? 'ParentStep2' : 'SitterStep2', base);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Unable to continue');
    } finally {
      setSubmitting(false);
    }
  };

  const goBackToStep1 = () => {
    navigation.navigate('SignupStep1', {
      name,
      email,
      password,
      role,
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
        {/* ✅ No ScrollView / FlatList parent to avoid VirtualizedList nesting & remounts */}
        <View style={{ paddingBottom: 16 }}>
          {/* Title */}
          <View style={styles.titleBox}>
            <Text style={[styles.h1, { color: THEME.text }]}>Your address</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>
              Step 2 · Location & (for sitters) hourly rate
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            {/* Address */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Address</Text>

              {hasPlacesKey ? (
                <GooglePlacesAutocomplete
                  placeholder="Start typing your address"
                  fetchDetails
                  minLength={2}
                  debounce={250}
                  enablePoweredByContainer={false}

                  // ✅ Defensive defaults to avoid ".filter of undefined" inside the lib
                  predefinedPlaces={[]}
                  predefinedPlacesAlwaysVisible={false}
                  filterReverseGeocodingByTypes={[]}
                  nearbyPlacesAPI="GooglePlacesSearch"
                  listEmptyComponent={<View style={{ padding: 8 }} />}

                  onPress={(data, details = null) => {
                    const addr = data?.description || '';
                    const lat = details?.geometry?.location?.lat ?? null;
                    const lng = details?.geometry?.location?.lng ?? null;
                    setAddress(addr);
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  onFail={(error) => {
                    console.warn('Places onFail:', error);
                    Alert.alert('Places error', 'Unable to fetch suggestions right now.');
                  }}
                  query={{
                    key: GOOGLE_PLACES_API_KEY,
                    language: 'en',
                    components: 'country:il', // Israel-first results
                  }}
                  styles={{
                    container: { flex: 0 },
                    textInputContainer: { padding: 0, margin: 0 },
                    textInput: {
                      height: 48,
                      paddingHorizontal: 14,
                      borderWidth: 1,
                      borderColor: THEME.border,
                      borderRadius: 14,
                      backgroundColor: '#FFF',
                      color: THEME.text,
                      fontSize: 16,
                    },
                    row: { paddingVertical: 10 },
                    listView: {
                      backgroundColor: '#fff',
                      borderWidth: 1,
                      borderColor: THEME.border,
                      borderRadius: 12,
                      marginTop: 6,
                      overflow: 'hidden',
                    },
                    separator: { height: StyleSheet.hairlineWidth, backgroundColor: THEME.border },
                    description: { color: THEME.text },
                    predefinedPlacesDescription: { color: THEME.textMuted },
                  }}
                  textInputProps={{
                    value: address,
                    placeholderTextColor: '#A8B3C2',
                    onChangeText: (t) => {
                      setAddress(t);
                      if (!t) {
                        setLatitude(null);
                        setLongitude(null);
                      }
                    },
                    returnKeyType: 'done',
                  }}
                />
              ) : (
                <>
                  <TextInput
                    placeholder="Enter your full address"
                    value={address}
                    onChangeText={(t) => {
                      setAddress(t);
                      if (!t) {
                        setLatitude(null);
                        setLongitude(null);
                      }
                    }}
                    style={[
                      styles.input,
                      { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                    ]}
                    placeholderTextColor="#A8B3C2"
                    returnKeyType="done"
                  />
                  <Text style={{ color: THEME.warn, fontSize: 12, marginTop: 6 }}>
                    Autocomplete disabled (set GOOGLE_PLACES_API_KEY in src/config.js).
                  </Text>
                </>
              )}
            </View>

            {/* Babysitter-only: hourly rate */}
            {role === 'babysitter' && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: THEME.textMuted }]}>Hourly rate (₪/h)</Text>
                <TextInput
                  value={String(hourlyRate)}
                  onChangeText={(t) => setHourlyRate(t.replace(/[^\d.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 45"
                  placeholderTextColor="#A8B3C2"
                  style={[
                    styles.input,
                    { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                  ]}
                  returnKeyType="done"
                />
                <Text style={{ color: THEME.textMuted, fontSize: 11, marginTop: 6 }}>
                  You can update your rate later from your profile.
                </Text>
              </View>
            )}

            {/* Helper note */}
            <Text style={[styles.note, { color: THEME.textMuted, marginTop: 8 }]}>
              We use your address to approximate distances. Payments happen in person.
            </Text>

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

            <Pressable onPress={goBackToStep1} style={styles.linkBtn}>
              <Text style={[styles.linkText, { color: THEME.secondary }]}>Back to previous</Text>
            </Pressable>
          </View>
        </View>
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

  // CTA
  cta: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // Links & notes
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkText: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 16 },
});
