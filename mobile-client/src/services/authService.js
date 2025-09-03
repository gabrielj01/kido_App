import api from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function signup(payload) {
  const { data } = await api.post('/api/auth/signup', payload);
  // Persist token for subsequent requests
  if (data?.token) {
    await AsyncStorage.setItem('token', data.token);
  }
  return data;
}

export async function login(email, password) {
  const { data } = await api.post('/api/auth/login', { email, password });
  if (data?.token) {
    await AsyncStorage.setItem('token', data.token);
  }
  return data;
}
