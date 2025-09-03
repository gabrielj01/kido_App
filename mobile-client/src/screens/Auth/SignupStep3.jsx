import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { checkUsernameAvailability } from '../../services/userService';

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;

export default function SignupStep3({ navigation }) {
  const route = useRoute();
  const [username, setUsername] = useState(route.params?.username || '');

  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null); // null | true | false
  const [netError, setNetError] = useState(null);   // string

  const timerRef = useRef(null);

  useEffect(() => {
    const u = username.trim();
    // Local validation
    if (!u || !USERNAME_RE.test(u)) {
      setAvailable(null);
      setNetError(null);
      setChecking(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    setChecking(true);
    setNetError(null);
    if (timerRef.current) clearTimeout(timerRef.current);

    const controller = new AbortController();

    timerRef.current = setTimeout(async () => {
      try {
        const ok = await checkUsernameAvailability(u, controller.signal);
        setAvailable(ok);
      } catch (e) {
        setAvailable(null);
        setNetError('Unable to verify username right now. You can continue and we will check on submit.');
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => {
      controller.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [username]);

  const finishDisabled = useMemo(() => {
    if (checking) return true;
    if (!USERNAME_RE.test(username.trim())) return true;
    if (available === false) return true; // explicitly taken -> block
    return false; // allow proceed if network error (final submit will check again)
  }, [checking, available, username]);

  const handleFinish = () => {
    navigation.navigate('Signup', {
      ...(route.params || {}),
      username: username.trim(),
    });
  };

  return (
    <View style={{ flex:1, justifyContent:'center', padding:16 }}>
      <Text style={{ fontSize:18, fontWeight:'700', marginBottom:8 }}>Choose a username</Text>

      <TextInput
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="e.g. alice_parent"
        style={{ borderWidth:1, borderColor:'#ddd', padding:12, borderRadius:8 }}
      />

      <View style={{ minHeight:22, marginTop:8 }}>
        {checking ? (
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <ActivityIndicator size="small" />
            <Text>Checking username…</Text>
          </View>
        ) : USERNAME_RE.test(username.trim()) && available === true ? (
          <Text style={{ color:'green' }}>Username available ✓</Text>
        ) : USERNAME_RE.test(username.trim()) && available === false ? (
          <Text style={{ color:'red' }}>Username already taken</Text>
        ) : null}
      </View>

      {netError ? (
        <Text style={{ color:'#b26a00', marginTop:6 }}>{netError}</Text>
      ) : null}

      <View style={{ height:12 }} />
      <Button title="Finish" onPress={handleFinish} disabled={finishDisabled} />
    </View>
  );
}
