import React, { createContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken]   = useState(null);
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Load token+user from storage on start
  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('user'),
        ]);
        if (t) setToken(t);
        if (u) setUser(JSON.parse(u));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep /users/me in sync when token changes
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data } = await api.get('/api/users/me');
        setUser(data);
        await AsyncStorage.setItem('user', JSON.stringify(data));
      } catch (err) {
        console.log('Profile fetch error', err?.response?.data || err.message);
      }
    })();
  }, [token]);

  // Persist token in storage whenever it changes
  useEffect(() => {
    if (token) AsyncStorage.setItem('token', token);
    else AsyncStorage.removeItem('token');
  }, [token]);

  // ---- Exposed actions ----
  const signIn = async (_token, _user) => {
    if (_token) await AsyncStorage.setItem('token', _token);
    if (_user)  await AsyncStorage.setItem('user', JSON.stringify(_user));
    setToken(_token || null);
    setUser(_user || null);
  };

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    await signIn(data.token, data.user);
    return data.user;
  };

  const signup = async (payload) => {
    // Throws on non-2xx so UI can handle per-field errors (409, etc.)
    const { data } = await api.post('/api/auth/signup', payload);
    await signIn(data.token, data.user);
    return data.user;
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ token, user, loading, setUser, signIn, login, signup, logout }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
