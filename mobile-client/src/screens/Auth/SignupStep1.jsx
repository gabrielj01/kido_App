import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, Button, Text, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { checkEmailAvailability } from '../../services/userService';

const isValidEmail = (v) => /\S+@\S+\.\S+/.test(String(v || '').trim());

export default function SignupStep1({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('parent');

  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null); // null | true | false
  const [emailError, setEmailError] = useState(null);         // network/unexpected error message

  const timerRef = useRef(null);

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
        // Show a friendly warning instead of staying silent
        setEmailAvailable(null);
        setEmailError('Unable to verify email right now. You can continue and we will check on submit.');
      } finally {
        setEmailChecking(false);
      }
    }, 500);

    return () => {
      controller.abort();               // cancel in-flight request if email changes/unmounts
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [email]);

  const nextDisabled = useMemo(() => {
    if (!name?.trim() || !password?.trim() || !isValidEmail(email)) return true;
    if (emailChecking) return true;          // wait while checking
    if (emailAvailable === false) return true; // explicitly taken
    // If emailError exists, allow proceed (will be checked again at final submit)
    return false;
  }, [name, password, email, emailChecking, emailAvailable, emailError]);

  const handleNext = () => {
    navigation.navigate('SignupStep2', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
    });
  };

  return (
    <View style={{ flex:1, justifyContent:'center', padding:16 }}>
      <Text>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={{ borderWidth:1, marginBottom:12, padding:8, borderRadius:8 }}
        placeholder="Your full name"
      />

      <Text>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth:1, marginBottom:6, padding:8, borderRadius:8 }}
        placeholder="you@example.com"
      />

      <View style={{ minHeight:22, marginBottom:4 }}>
        {emailChecking ? (
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <ActivityIndicator size="small" />
            <Text>Checking email…</Text>
          </View>
        ) : isValidEmail(email) && emailAvailable === true ? (
          <Text style={{ color:'green' }}>Email available ✓</Text>
        ) : isValidEmail(email) && emailAvailable === false ? (
          <Text style={{ color:'red' }}>Email already in use</Text>
        ) : null}
      </View>

      {emailError ? (
        <Text style={{ color:'#b26a00', marginBottom:8 }}>
          {emailError}
        </Text>
      ) : null}

      <Text>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth:1, marginBottom:12, padding:8, borderRadius:8 }}
        placeholder="Choose a password"
      />

      <Text>Role</Text>
      <Picker
        selectedValue={role}
        onValueChange={val => setRole(val)}
        style={{ height:50, width:'100%', marginBottom:12 }}
      >
        <Picker.Item label="Parent" value="parent" />
        <Picker.Item label="Babysitter" value="babysitter" />
      </Picker>

      <Button title="Next" onPress={handleNext} disabled={nextDisabled} />
    </View>
  );
}
