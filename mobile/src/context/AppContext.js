import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { io } from 'socket.io-client';
import { SOCKET_URL, API_URL } from '../config';
import { appStorage } from '../utils/storage';

/**
 * Bac à Sable — passage de jeton d'imitation depuis le Laboratoire (web).
 * Le Back Office ouvre l'app avec `#labToken=<jeton>` : on résout l'acteur via
 * l'organe d'identité applicatif (/api/users/me) puis on ouvre sa session.
 * Aucune donnée n'est modifiée : entrer dans un acteur est une authentification.
 */
async function consumeLabToken() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const match = (window.location.hash || '').match(/labToken=([^&]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  try {
    const res = await fetch(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Retire le jeton de la barre d'adresse.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return { token, user: data.user };
  } catch {
    return null;
  }
}

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
        // Priorité au jeton d'imitation du Laboratoire (web) s'il est présent.
        const lab = await consumeLabToken();
        if (lab) {
          setToken(lab.token);
          setUser(lab.user);
          await appStorage.setItem('token', lab.token);
          await appStorage.setItem('user', JSON.stringify(lab.user));
          connectSocket(lab.token, lab.user);
          return;
        }

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
