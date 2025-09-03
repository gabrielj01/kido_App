import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { Picker } from '@react-native-picker/picker';


export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={{ flex:1, justifyContent:'center', padding:16 }}>
      <Text>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth:1, marginBottom:12, padding:8 }}
      />

      <Text>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth:1, marginBottom:12, padding:8 }}
      />

      <Button title="Log In" onPress={() => login(email, password)} />
      <Text
       style={{ marginTop:16, color:'blue' }}
       onPress={() => navigation.navigate('SignupStep1')}
     >
       Don't have an account? Sign up
     </Text>
    </View>
  );
}
