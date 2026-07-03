import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { appStorage } from '../utils/storage';

export const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [socket, setSocket]   = useState(null);
  const [loading, setLoading] = useState(true);

  const disconnectSocket = useCallback(() => {
    setSocket((current) => {
      if (current) {
        current.emit('driver:offline');
        current.removeAllListeners();
        current.disconnect();
      }
      return null;
    });
  }, []);

  const connectSocket = useCallback((authToken, userData) => {
    disconnectSocket();

    const s = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    s.on('connect', () => {
      console.log(`[Socket] Connecté (${userData.role})`);
    });

    s.on('connect_error', (err) => console.warn('[Socket] Erreur :', err.message));
    s.on('disconnect', (reason) => console.log('[Socket] Déconnecté :', reason));

    setSocket(s);
    return s;
  }, [disconnectSocket]);

  // Restaurer la session au démarrage (1 session par onglet sur le web)
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await appStorage.getItem('token');
        const savedUser  = await appStorage.getItem('user');
        if (savedToken && savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setToken(savedToken);
          setUser(parsedUser);
          connectSocket(savedToken, parsedUser);
        }
      } catch (e) {
        console.warn('Erreur restauration session', e);
      } finally {
        setLoading(false);
      }
    })();

    return () => disconnectSocket();
  }, [connectSocket, disconnectSocket]);

  async function loginUser(userData, authToken) {
    setUser(userData);
    setToken(authToken);
    await appStorage.setItem('token', authToken);
    await appStorage.setItem('user', JSON.stringify(userData));
    connectSocket(authToken, userData);
  }

  async function updateUser(patch) {
    setUser((prev) => {
      const merged = { ...prev, ...patch };
      appStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  }

  async function logoutUser() {
    disconnectSocket();
    setUser(null);
    setToken(null);
    await appStorage.clear();
  }

  return (
    <AppContext.Provider value={{
      user,
      token,
      socket,
      loading,
      loginUser,
      logoutUser,
      updateUser,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
