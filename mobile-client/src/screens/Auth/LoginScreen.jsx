import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const THEME = useMemo(
    () => ({
      primary: '#FF7A59', // warm playful orange
      secondary: '#4ECDC4', // teal accent
      bg: '#F7F9FC', // soft background
      card: '#FFFFFF',
      text: '#1F2D3D',
      textMuted: '#6B7A90',
      border: '#E6ECF2',
      danger: '#E63946',
    }),
    []
  );

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please fill in email and password.');
      return;
    }
    Keyboard.dismiss();
    try {
      setSubmitting(true);
      await Promise.resolve(login(email.trim(), password));
    } catch (e) {
      setError(e?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: THEME.bg }]}>
      {/* Decorative colorful header */}
      <View style={styles.headerWrap} pointerEvents="none">
        <View style={[styles.blob, { backgroundColor: THEME.primary, top: -60, left: -40, opacity: 0.2 }]} />
        <View style={[styles.blob, { backgroundColor: THEME.secondary, top: -20, right: -50, width: 220, height: 220, opacity: 0.25 }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* Title */}
        <View style={styles.titleBox}>
          <Text style={[styles.h1, { color: THEME.text }]}>Welcome back 👋</Text>
          <Text style={[styles.sub, { color: THEME.textMuted }]}>
            Log in to find trusted babysitters near you.
          </Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: THEME.card, shadowColor: THEME.text }]}>
          {/* Email */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: THEME.textMuted }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
              placeholderTextColor="#A8B3C2"
              style={[
                styles.input,
                { borderColor: THEME.border, color: THEME.text, backgroundColor: '#FFF' },
              ]}
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: THEME.textMuted }]}>Password</Text>
            <View
              style={[
                styles.inputRow,
                { borderColor: THEME.border, backgroundColor: '#FFF' },
              ]}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={secure}
                placeholder="••••••••"
                placeholderTextColor="#A8B3C2"
                style={[styles.inputFlex, { color: THEME.text }]}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
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
          </View>

          {/* Error */}
          {!!error && (
            <Text style={[styles.error, { color: THEME.danger }]}>{error}</Text>
          )}

          {/* Login button */}
          <Pressable
            onPress={handleLogin}
            disabled={submitting}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: submitting ? '#FFB39F' : THEME.primary,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>Log in</Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.hr, { backgroundColor: THEME.border }]} />
            <Text style={[styles.hrText, { color: THEME.textMuted }]}>or</Text>
            <View style={[styles.hr, { backgroundColor: THEME.border }]} />
          </View>

          {/* Sign up link */}
          <Pressable onPress={() => navigation.navigate('SignupStep1')} style={styles.linkBtn}>
            <Text style={[styles.linkText, { color: THEME.secondary }]}>
              Don&apos;t have an account? Sign up
            </Text>
          </Pressable>
        </View>

        {/* Bottom helper text */}
        <View style={styles.footerNote}>
          <Text style={[styles.note, { color: THEME.textMuted }]}>
            Payments are in-person. No online payments needed.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // --- Layout shells
  safe: { flex: 1 },
  flex: { flex: 1, justifyContent: 'center' },

  // --- Decorative blobs
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  blob: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 100,
    transform: [{ rotate: '12deg' }],
  },

  // --- Typography
  titleBox: { paddingHorizontal: 24, marginBottom: 12, marginTop: 12 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: 0.2 },
  sub: { marginTop: 6, fontSize: 14 },

  // --- Card container
  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  // --- Fields
  field: { marginBottom: 14 },
  label: { marginBottom: 8, fontSize: 13, fontWeight: '600' },
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

  // --- Error text
  error: { marginTop: 2, marginBottom: 6, fontSize: 13, fontWeight: '600' },

  // --- CTA button
  cta: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // --- Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  hr: { flex: 1, height: 1, borderRadius: 1 },
  hrText: { marginHorizontal: 10, fontSize: 12, fontWeight: '600' },

  // --- Links & footer
  linkBtn: { alignItems: 'center', paddingVertical: 6 },
  linkText: { fontSize: 14, fontWeight: '700' },
  footerNote: { alignItems: 'center', marginTop: 8 },
  note: { fontSize: 12 },
});
