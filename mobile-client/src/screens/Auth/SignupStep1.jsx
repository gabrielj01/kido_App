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
import { checkEmailAvailability, checkUsernameAvailability } from '../../services/userService';

let importedDefault, importedNS;
try {
  importedDefault = require('../../theme/color').default;
  importedNS = require('../../theme/color');
} catch (_) {
  importedDefault = null;
  importedNS = {};
}
const importedColors = importedNS?.colors || importedDefault || importedNS?.default || null;

// --- Simple validators & helpers (kept local to this file) ---
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;
const isValidEmail = (v) => /\S+@\S+\.\S+/.test(String(v || '').trim());
const digitsOnly = (v) => String(v || '').replace(/[^\d+]/g, '');
const toE164IL = (v) => {
  const s = digitsOnly(v);
  if (s.startsWith('+972')) return s;
  const d = s.replace(/\D/g, '');
  if (d.startsWith('972')) return '+972' + d.slice(3);
  if (d.startsWith('0')) return '+972' + d.slice(1);
  return '';
};
const isValidILPhone = (v) => /^\+972(?:[2-9]\d{7}|5\d{8})$/.test(toE164IL(v));

export default function SignupStep1({ navigation }) {
  // --- Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(''); // moved to Step 1
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [role, setRole] = useState('parent');
  const [phone, setPhone] = useState('');

  // --- Refs
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);

  // --- Live email availability
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);
  const [emailError, setEmailError] = useState(null);

  // --- Live username availability
  const [userChecking, setUserChecking] = useState(false);
  const [userAvailable, setUserAvailable] = useState(null);
  const [userError, setUserError] = useState(null);

  // --- Debounce timers (separate for email & username)
  const emailTimerRef = useRef(null);
  const userTimerRef = useRef(null);

  // --- Theme (merged with optional external theme)
  const THEME = useMemo(
    () => ({
      primary: importedColors?.primary ?? '#FF7A59',     // playful orange
      secondary: importedColors?.secondary ?? '#4ECDC4', // teal accent
      bg: importedColors?.bg ?? '#F7F9FC',
      card: importedColors?.card ?? '#FFFFFF',
      text: importedColors?.textDark ?? '#1F2D3D',
      textMuted: importedColors?.textLight ?? '#6B7A90',
      border: importedColors?.border ?? '#E6ECF2',
      danger: importedColors?.danger ?? '#E63946',
      ok: '#2BA84A',
      warn: '#B26A00',
    }),
    []
  );

  // --- Debounced email availability check
  useEffect(() => {
    const e = (email || '').trim().toLowerCase();

    if (!e || !isValidEmail(e)) {
      setEmailAvailable(null);
      setEmailError(null);
      setEmailChecking(false);
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      return;
    }

    setEmailChecking(true);
    setEmailError(null);
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    const controller = new AbortController();

    emailTimerRef.current = setTimeout(async () => {
      try {
        const available = await checkEmailAvailability(e, controller.signal);
        setEmailAvailable(available);
      } catch (err) {
        setEmailAvailable(null);
        setEmailError('Unable to verify email right now. We will re-check on submit.');
      } finally {
        setEmailChecking(false);
      }
    }, 500);

    return () => {
      controller.abort();
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    };
  }, [email]);

  // --- Debounced username availability check
  useEffect(() => {
    const u = (username || '').trim().toLowerCase();

    if (!u || !USERNAME_RE.test(u)) {
      setUserAvailable(null);
      setUserError(null);
      setUserChecking(false);
      if (userTimerRef.current) clearTimeout(userTimerRef.current);
      return;
    }

    setUserChecking(true);
    setUserError(null);
    if (userTimerRef.current) clearTimeout(userTimerRef.current);
    const controller = new AbortController();

    userTimerRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(u, controller.signal);
        setUserAvailable(available);
      } catch (err) {
        setUserAvailable(null);
        setUserError('Unable to verify username right now. We will re-check on submit.');
      } finally {
        setUserChecking(false);
      }
    }, 500);

    return () => {
      controller.abort();
      if (userTimerRef.current) clearTimeout(userTimerRef.current);
    };
  }, [username]);

  // --- Disable "Next" if invalid
  const nextDisabled = useMemo(() => {
    if (!name?.trim()) return true;
    if (!isValidEmail(email)) return true;
    if (!USERNAME_RE.test((username || '').trim())) return true;
    if (userChecking || emailChecking) return true;
    if (emailAvailable === false) return true;
    if (userAvailable === false) return true;
    if (typeof password !== 'string' || password.length < 6) return true; // minimal rule
    if (!isValidILPhone(phone)) return true;
    return false;
  }, [name, email, username, userChecking, emailChecking, emailAvailable, userAvailable, password, phone]);

  // --- Go next (to photo step)
  const handleNext = () => {
    Keyboard.dismiss();
    navigation.navigate('SignupPhoto', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      username: username.trim().toLowerCase(),
      password,
      role,
      phone: toE164IL(phone),
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: THEME.bg }]}>
      {/* Decorative header blobs */}
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
            {/* Full name */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Full name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="#A8B3C2"
                style={[styles.input, { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' }]}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>

            {/* Email */}
            <View className="field">
              <Text style={[styles.label, { color: THEME.textMuted }]}>Email</Text>
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#A8B3C2"
                style={[styles.input, { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' }]}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => {}}
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

            {/* Username */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Username</Text>
              <TextInput
                value={username}
                onChangeText={(t) => setUsername(t)}
                placeholder="e.g., avi_parent_2025"
                placeholderTextColor="#A8B3C2"
                style={[styles.input, { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
              {/* Username live feedback */}
              <View style={{ minHeight: 22, marginTop: 6 }}>
                {!username ? null : !USERNAME_RE.test((username || '').trim()) ? (
                  <Text style={{ color: THEME.warn, fontSize: 12 }}>
                    3–20 chars. Letters, digits, dot, dash, underscore only.
                  </Text>
                ) : userChecking ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" />
                    <Text style={{ color: THEME.textMuted, fontSize: 12 }}>Checking username…</Text>
                  </View>
                ) : userAvailable === true ? (
                  <Text style={{ color: THEME.ok, fontSize: 12 }}>Username available ✓</Text>
                ) : userAvailable === false ? (
                  <Text style={{ color: THEME.danger, fontSize: 12 }}>Username already in use</Text>
                ) : userError ? (
                  <Text style={{ color: THEME.warn, fontSize: 12 }}>{userError}</Text>
                ) : null}
              </View>
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: THEME.textMuted }]}>Phone</Text>
              <TextInput
                ref={phoneRef}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 050-123-4567"
                placeholderTextColor="#A8B3C2"
                style={[styles.input, { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' }]}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                testID="signup-phone"
              />
              <View style={{ minHeight: 18, marginTop: 6 }}>
                {!!phone && !isValidILPhone(phone) ? (
                  <Text style={{ color: THEME.warn, fontSize: 12 }}>
                    Please enter a valid Israeli phone (will be saved as +972…).
                  </Text>
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
                Minimum 6 characters.
              </Text>
            </View>

            {/* Role selector */}
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
              {emailChecking || userChecking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>Next</Text>}
            </Pressable>

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
