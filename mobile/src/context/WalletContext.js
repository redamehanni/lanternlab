import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { getWallet } from '../api';
import { useApp } from './AppContext';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const { user, socket } = useApp();
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || user.role !== 'client') {
      setFamilies([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getWallet();
      setFamilies(res.data.families || []);
    } catch {
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Le Wallet est un espace vivant : il se met à jour quand un organe émet,
  // consomme ou révoque un objet du citoyen.
  useEffect(() => {
    if (!socket || user?.role !== 'client') return undefined;
    const reload = () => refresh();
    socket.on('wallet:object_issued', reload);
    socket.on('wallet:object_consumed', reload);
    socket.on('wallet:object_revoked', reload);
    return () => {
      socket.off('wallet:object_issued', reload);
      socket.off('wallet:object_consumed', reload);
      socket.off('wallet:object_revoked', reload);
    };
  }, [socket, user?.role, refresh]);

  const totalCount = useMemo(
    () => families.reduce((sum, f) => sum + (f.count || 0), 0),
    [families]
  );

  const value = useMemo(
    () => ({ families, loading, totalCount, refresh }),
    [families, loading, totalCount, refresh]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  return useContext(WalletContext);
}
