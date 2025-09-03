// screens/Auth/SignupStep1.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { checkEmailAvailability } from '../../services/userService';

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

const isValidEmail = (v) => /\S+@\S+\.\S+/.test(String(v || '').trim());

export default function SignupStep1({ navigation }) {
  // --- Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [role, setRole] = useState('parent'); // 'parent' | 'babysitter'

  // --- Live email availability
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null); // null | true | false
  const [emailError, setEmailError] = useState(null);

  // --- Refs for smooth "Next" on keyboard
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const timerRef = useRef(null);

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
      ok: '#2BA84A',   // success green
      warn: '#B26A00', // amber
    }),
    []
  );

  // --- Debounced email availability check
  useEffect(() => {
    // Reset state if email invalid or empty
    if (!email || !isValidEmail(email)) {
      setEmailAvailable(null);
      setEmailError(null);
      setEmailChecking(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    setEmailChecking(true);
    setEmailError(null);
    if (timerRef.current) clearTimeout(timerRef.current);

    const controller = new AbortController();

    timerRef.current = setTimeout(async () => {
      try {
        const available = await checkEmailAvailability(email.trim().toLowerCase(), controller.signal);
        setEmailAvailable(available);
      } catch (e) {
        // Show a friendly warning instead of failing silently
        setEmailAvailable(null);
        setEmailError('Unable to verify email right now. We will re-check on submit.');
      } finally {
        setEmailChecking(false);
      }
    }, 500);

    return () => {
      controller.abort(); // cancel in-flight request if email changes/unmounts
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [email]);

  // --- Disable Next if fields invalid or email explicitly taken
  const nextDisabled = useMemo(() => {
    if (!name?.trim() || !password?.trim() || !isValidEmail(email)) return true;
    if (emailChecking) return true;           // wait while checking
    if (emailAvailable === false) return true; // explicitly taken
    // If emailError exists, allow proceed (server will re-check later)
    return false;
  }, [name, password, email, emailChecking, emailAvailable, emailError]);

  const handleNext = () => {
    Keyboard.dismiss();
    navigation.navigate('SignupStep2', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
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
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.titleBox}>
            <Text style={[styles.h1, { color: THEME.text }]}>Create your account</Text>
            <Text style={[styles.sub, { color: THEME.textMuted }]}>
              Step 1 · Basic information
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
            {/* Name */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Full name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="#A8B3C2"
                style={[
                  styles.input,
                  { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                ]}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Email</Text>
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#A8B3C2"
                style={[
                  styles.input,
                  { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
                ]}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              {/* Email live feedback */}
              <View style={{ minHeight: 22, marginTop: 6 }}>
                {emailChecking ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" />
                    <Text style={{ color: THEME.textMuted, fontSize: 12 }}>Checking email…</Text>
                  </View>
                ) : !!email && !isValidEmail(email) ? (
                  <Text style={{ color: THEME.warn, fontSize: 12 }}>Please enter a valid email.</Text>
                ) : isValidEmail(email) && emailAvailable === true ? (
                  <Text style={{ color: THEME.ok, fontSize: 12 }}>Email available ✓</Text>
                ) : isValidEmail(email) && emailAvailable === false ? (
                  <Text style={{ color: THEME.danger, fontSize: 12 }}>Email already in use</Text>
                ) : null}
                {emailError ? (
                  <Text style={{ color: THEME.warn, fontSize: 12, marginTop: 2 }}>{emailError}</Text>
                ) : null}
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Password</Text>
              <View style={[styles.inputRow, { borderColor: THEME.border, backgroundColor: '#FFF' }]}>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secure}
                  placeholder="••••••••"
                  placeholderTextColor="#A8B3C2"
                  style={[styles.inputFlex, { color: THEME.text }]}
                  returnKeyType="done"
                  onSubmitEditing={() => !nextDisabled && handleNext()}
                />
                <Pressable
                  onPress={() => setSecure((s) => !s)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={secure ? 'Show password' : 'Hide password'}
                >
                  <Text style={{ color: THEME.textMuted }}>{secure ? 'Show' : 'Hide'}</Text>
                </Pressable>
              </View>
              <Text style={{ color: THEME.textMuted, fontSize: 11, marginTop: 6 }}>
                For MVP, any password is accepted. You can change it later in your profile.
              </Text>
            </View>

            {/* Role selector (segmented buttons) */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>I am</Text>
              <View style={styles.segmentWrap}>
                {['parent', 'babysitter'].map((opt) => {
                  const active = role === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setRole(opt)}
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
                      <Text style={{ color: active ? '#073B4C' : THEME.text, fontWeight: '700' }}>
                        {opt === 'parent' ? 'Parent' : 'Babysitter'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* CTA */}
            <Pressable
              onPress={handleNext}
              disabled={nextDisabled}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: nextDisabled ? '#FFB39F' : THEME.primary,
                  transform: [{ scale: pressed && !nextDisabled ? 0.98 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              {emailChecking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Next</Text>}
            </Pressable>

            {/* Small note */}
            <Text style={[styles.note, { color: THEME.textMuted, marginTop: 10 }]}>
              Payments are in-person. No online payments needed.
            </Text>
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
  titleBox: { paddingHorizontal: 24, marginBottom: 12, marginTop: 12 },

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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 8,
  },
  inputFlex: { flex: 1, fontSize: 16 },
  eyeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },

  // Segmented role selector
  segmentWrap: { flexDirection: 'row', gap: 10 },
  segmentBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CTA
  cta: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // Notes
  note: { fontSize: 12, lineHeight: 16 },
});

