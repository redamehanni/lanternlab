import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Linking } from 'react-native';
import { io } from 'socket.io-client';
import { SOCKET_URL, API_URL } from '../config';
import { appStorage } from '../utils/storage';
import { navigateToSoul } from '../navigation/navigationRef';
import { onUnauthorized } from '../api';
import { extractLabTokenFromUrl, resolveLabSession } from '../utils/labToken';

/**
 * Bac à Sable — passage de jeton d'imitation depuis le Laboratoire.
 *
 * Web  : le Back Office ouvre `#labToken=<jeton>` dans le navigateur.
 * iOS  : le Back Office demande au backend d'ouvrir Expo Go via
 *        `exp://…/--/lab?labToken=<jeton>` (bouton « Devenir X sur Xcode »).
 *
 * Dans les deux cas : on résout l'acteur via /api/users/me puis on ouvre
 * sa session. Aucune donnée n'est modifiée — c'est une authentification.
 */
async function consumeLabTokenFromWebHash() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const token = extractLabTokenFromUrl(window.location.hash || window.location.href);
  if (!token) return null;
  try {
    const session = await resolveLabSession(token, API_URL);
    if (session) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return session;
  } catch {
    return null;
  }
}

async function consumeLabTokenFromLinking() {
  if (Platform.OS === 'web') return null;
  try {
    const initial = await Linking.getInitialURL();
    const token = extractLabTokenFromUrl(initial);
    if (!token) return null;
    return resolveLabSession(token, API_URL);
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
  // Face active de Ma Zone : 'first' = Première Âme (Marketplace), 'second' =
  // Deuxième Âme (vie de quartier). Les deux faces partagent la même session et
  // les mêmes organes (panier, wallet, messagerie). Persisté pour la continuité.
  const [activeSoul, setActiveSoul] = useState('first');

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

  const logoutRef = useRef(null);

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

    s.on('connect_error', (err) => {
      console.warn('[Socket] Erreur :', err.message);
      // JWT mort en AsyncStorage → même symptôme que les 401 REST (Mode Réception, OV).
      if (err.message === 'Token invalide' || err.message === 'Token manquant') {
        s.io.opts.reconnection = false;
        logoutRef.current?.();
      }
    });
    s.on('disconnect', (reason) => console.log('[Socket] Déconnecté :', reason));

    setSocket(s);
    return s;
  }, [disconnectSocket]);

  async function logoutUser() {
    disconnectSocket();
    setUser(null);
    setToken(null);
    setActiveSoul('first');
    await appStorage.clear();
  }
  logoutRef.current = logoutUser;

  // Purge automatique si une API authentifiée renvoie 401 (session zombie).
  useEffect(() => {
    onUnauthorized(() => { logoutRef.current?.(); });
    return () => onUnauthorized(null);
  }, []);

  // Restaurer la session au démarrage (1 session par onglet sur le web)
  useEffect(() => {
    (async () => {
      try {
        // Priorité au jeton d'imitation du Laboratoire (web hash OU deep link iOS).
        const lab = (await consumeLabTokenFromWebHash()) || (await consumeLabTokenFromLinking());
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
          // Valider le JWT auprès de l'organe avant d'ouvrir la session :
          // sinon l'UI croit être connectée alors que Mode Réception / sockets échouent.
          const meRes = await fetch(`${API_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (!meRes.ok) {
            await appStorage.clear();
            return;
          }
          const meData = await meRes.json();
          const freshUser = meData.user || JSON.parse(savedUser);
          setToken(savedToken);
          setUser(freshUser);
          await appStorage.setItem('user', JSON.stringify(freshUser));
          connectSocket(savedToken, freshUser);
        }
        const savedSoul = await appStorage.getItem('activeSoul');
        if (savedSoul === 'second' || savedSoul === 'first') setActiveSoul(savedSoul);
      } catch (e) {
        console.warn('Erreur restauration session', e);
        await appStorage.clear().catch(() => {});
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
  const loginRef = useRef(loginUser);
  loginRef.current = loginUser;

  // Deep link « Devenir X sur Xcode » pendant que l'app est déjà ouverte.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const onUrl = ({ url }) => {
      const labToken = extractLabTokenFromUrl(url);
      if (!labToken) return;
      (async () => {
        try {
          const session = await resolveLabSession(labToken, API_URL);
          if (!session) {
            console.warn('[Lab] Deep link : jeton invalide');
            return;
          }
          await loginRef.current(session.user, session.token);
          console.log(`[Lab] Session ouverte : ${session.user?.name} (${session.user?.role})`);
        } catch (e) {
          console.warn('[Lab] Deep link impossible', e);
        }
      })();
    };

    const sub = Linking.addEventListener('url', onUrl);
    return () => sub.remove();
  }, []);

  async function updateUser(patch) {
    setUser((prev) => {
      const merged = { ...prev, ...patch };
      appStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  }

  // Bascule entre les deux faces. Met à jour l'état persisté PUIS navigue vers
  // l'écran frère correspondant (FirstSoul / SecondSoul) — sans démonter la racine.
  const switchSoul = useCallback((target) => {
    setActiveSoul((prev) => {
      const next = target === 'first' || target === 'second' ? target : (prev === 'first' ? 'second' : 'first');
      appStorage.setItem('activeSoul', next);
      // Laisser le drawer se fermer / le rendu se stabiliser avant le reset.
      setTimeout(() => navigateToSoul(next), 50);
      return next;
    });
  }, []);

  return (
    <AppContext.Provider value={{
      user,
      token,
      socket,
      loading,
      activeSoul,
      switchSoul,
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
