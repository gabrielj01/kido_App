// mobile-client/src/screens/Babysitter/SitterHome.jsx
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';

export default function SitterHome({ navigation }) {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, Babysitter !</Text>
      {/* Ici arriveront plus tard la liste des demandes et le calendrier */}
      <Button title="Logout" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    padding:16
  },
  title: {
    fontSize:24,
    marginBottom:24
  }
});
