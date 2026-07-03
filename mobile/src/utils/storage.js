import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sur le web, sessionStorage = 1 session par onglet.
 * localStorage (AsyncStorage web) est partagé entre tous les onglets →
 * le client / commerçant / livreur s'écrasent mutuellement.
 */
const webStorage = {
  getItem: (key) => Promise.resolve(
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null
  ),
  setItem: (key, value) => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
    return Promise.resolve();
  },
  clear: () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
    return Promise.resolve();
  },
};

export const appStorage = Platform.OS === 'web' ? webStorage : AsyncStorage;
