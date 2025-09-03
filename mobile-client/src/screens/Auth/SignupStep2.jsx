// mobile-client/src/screens/Auth/SignupStep2.jsx
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../../config';

export default function SignupStep2({ navigation, route }) {
  // Step1 base data
  const { name, email, password, role = 'parent' } = route?.params || {};

  const initialAddress =
    route?.params?.addressData?.address ?? route?.params?.address ?? '';
  const initialLat =
    route?.params?.addressData?.latitude ?? route?.params?.latitude ?? null;
  const initialLng =
    route?.params?.addressData?.longitude ?? route?.params?.longitude ?? null;

  // Local state
  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState(initialLat);
  const [longitude, setLongitude] = useState(initialLng);
  const [hourlyRate, setHourlyRate] = useState(
    role === 'babysitter' ? String(route?.params?.hourlyRate ?? '') : ''
  );

  const canNext = useMemo(() => {
    if (!address?.trim()) return false;
    if (role === 'babysitter') {
      const n = Number(hourlyRate);
      return Number.isFinite(n) && n > 0;
    }
    return true;
  }, [address, role, hourlyRate]);

  const onNext = () => {
    const base = {
      name,
      email,
      password,
      role,
      addressData: {
        address,
        latitude,
        longitude,
      },
      ...(role === 'babysitter' ? { hourlyRate: Number(hourlyRate) } : {}),
    };

    if (!latitude || !longitude) {
      console.log('No lat/lng set — continuing with typed address only.');
    }

    navigation.navigate(role === 'parent' ? 'ParentStep2' : 'SitterStep2', base);
  };

  const hasPlacesKey =
    typeof GOOGLE_PLACES_API_KEY === 'string' &&
    GOOGLE_PLACES_API_KEY.trim().length > 10;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Signup — Step 2</Text>
        <Text style={{ color: '#6b7280', marginTop: 4 }}>
          Provide your address. If autocomplete is unavailable, type it manually.
        </Text>

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Your address</Text>

          {hasPlacesKey ? (
            <GooglePlacesAutocomplete
              placeholder="Start typing your address"
              fetchDetails
              minLength={2}
              debounce={250}
              enablePoweredByContainer={false}
              predefinedPlaces={[]}
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
                components: 'country:il',
              }}
              styles={{
                container: { flex: 0 },
                textInput: {
                  height: 44,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                },
                listView: {
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 8,
                  marginTop: 6,
                },
              }}
              textInputProps={{
                value: address,
                placeholderTextColor: '#9ca3af',
                onChangeText: (t) => {
                  setAddress(t);
                  if (!t) { setLatitude(null); setLongitude(null); }
                },
              }}
            />
          ) : (
            <>
              <TextInput
                placeholder="Enter your full address"
                value={address}
                onChangeText={(t) => {
                  setAddress(t);
                  if (!t) { setLatitude(null); setLongitude(null); }
                }}
                style={{
                  height: 44,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  marginBottom: 8,
                }}
                placeholderTextColor="#9ca3af"
              />
              <Text style={{ color: '#b26a00', fontSize: 12 }}>
                Autocomplete disabled (set GOOGLE_PLACES_API_KEY in src/config.js).
              </Text>
            </>
          )}
        </View>

        {role === 'babysitter' && (
          <View style={{ marginTop: 18 }}>
            <Text style={{ fontWeight: '700', marginBottom: 6 }}>Hourly rate (₪/h)</Text>
            <TextInput
              value={String(hourlyRate)}
              onChangeText={(t) => setHourlyRate(t.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="e.g. 45"
              placeholderTextColor="#9ca3af"
              style={{
                height: 44,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: '#ccc',
                borderRadius: 8,
                backgroundColor: '#fff',
              }}
            />
          </View>
        )}

        <View style={{ marginTop: 20 }}>
          <Button title="Next" onPress={onNext} disabled={!canNext} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
