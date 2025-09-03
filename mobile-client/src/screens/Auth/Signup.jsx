// screens/Auth/Signup.jsx
import React, { useContext, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { AuthContext } from '../../contexts/AuthContext';

// Robust theme import with fallback
let importedDefault, importedNS;
try {
  importedDefault = require('../../theme/colors').default;
  importedNS = require('../../theme/colors');
} catch (_) {
  importedDefault = null;
  importedNS = {};
}
const colors =
  importedNS?.colors ||
  importedDefault ||
  importedNS?.default || {
    primary: '#4E8AF0',
    textDark: '#1F2937',
    textLight: '#6B7280',
    bg: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E5E7EB',
  };

export default function Signup() {
  const route = useRoute();
  const { signup } = useContext(AuthContext);
  const [submitting, setSubmitting] = useState(false);

  const payload = useMemo(
    () => ({
      name: route.params?.name,
      email: route.params?.email?.toLowerCase(),
      username: route.params?.username ? String(route.params.username).toLowerCase() : undefined,
      password: route.params?.password,
      role: route.params?.role || 'parent',
      address: route.params?.address,
      latitude: route.params?.latitude,
      longitude: route.params?.longitude,
      hourlyRate: route.params?.hourlyRate,
      certifications: route.params?.certifications,
      experience: route.params?.experience,
      age: route.params?.age,
      bio: route.params?.bio,
      photoUrl: route.params?.photoUrl,
    }),
    [route.params]
  );

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      await signup(payload); // <-- updates token + user in context
      Alert.alert('Welcome!', 'Your account has been created.');
      // No manual navigation.reset: AppNavigator will switch stacks automatically
    } catch (err) {
      const status = err?.response?.status;
      const field  = err?.response?.data?.field;
      const code   = err?.response?.data?.error;

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

  return (
    <View style={{ flex:1, padding:16, backgroundColor: colors.bg }}>
      <Text style={{ fontSize:20, fontWeight:'800', color:colors.textDark, marginBottom:12 }}>
        Review & Create Account
      </Text>

      <Text style={{ color:colors.textLight }}>
        Name: <Text style={{ color:colors.textDark }}>{payload.name}</Text>
      </Text>
      <Text style={{ color:colors.textLight }}>
        Email: <Text style={{ color:colors.textDark }}>{payload.email}</Text>
      </Text>
      {payload.username ? (
        <Text style={{ color:colors.textLight }}>
          Username: <Text style={{ color:colors.textDark }}>{payload.username}</Text>
        </Text>
      ) : null}
      <Text style={{ color:colors.textLight }}>
        Role: <Text style={{ color:colors.textDark }}>{payload.role}</Text>
      </Text>
      {payload.address ? (
        <Text style={{ color:colors.textLight }}>
          Address: <Text style={{ color:colors.textDark }}>{payload.address}</Text>
        </Text>
      ) : null}

      <View style={{ height:18 }} />

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        style={{
          backgroundColor: colors.primary,
          opacity: submitting ? 0.7 : 1,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color:'#fff', fontWeight:'800' }}>Create my account</Text>
        )}
      </Pressable>
    </View>
  );
}
