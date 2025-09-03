// mobile-client/src/screens/Parent/ParentHome.jsx
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';

export default function ParentHome({ navigation }) {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Parent !</Text>
      {/* Ici arriveront plus tard les composants de recherche et de réservation */}
      <Button title="Logout" onPress={logout} />
      <Button title="My Profile" onPress={() => navigation.navigate('Profile')} />
      <View style={{ height: 8 }} />
      <Button
        title="Edit Profile"
        onPress={() => navigation.navigate('EditProfile', { initial: undefined })}
      />
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
