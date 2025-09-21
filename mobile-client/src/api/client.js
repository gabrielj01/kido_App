import axios from 'axios';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create a single Axios instance for the whole app
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Attach JWT token if present
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ⬅️ Export **default**
export default api;
