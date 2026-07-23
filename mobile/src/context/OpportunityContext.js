import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';
import { getOpportunityInbox } from '../api';

/**
 * Opportunité Volante — écoute temps réel + boîte aux lettres.
 *
 * L'organe diffuse via `event:opportunity` ; cette surface :
 *  - expose la dernière opportunité (bannière) ;
 *  - maintient un compteur de non-lus pour la boîte aux lettres ;
 *  - rafraîchit l'inbox au push.
 * Aucune logique métier : l'organe décide qui reçoit.
 */
const OpportunityContext = createContext(null);

export function OpportunityProvider({ children }) {
  const { user, socket } = useApp();
  const [current, setCurrent] = useState(null);
  const [unread, setUnread] = useState(0);

  const dismiss = useCallback(() => setCurrent(null), []);

  const refreshUnread = useCallback(async () => {
    if (!user || user.role !== 'client') { setUnread(0); return; }
    try {
      const res = await getOpportunityInbox({ status: 'received' });
      setUnread(res.data.unread ?? (res.data.items || []).length);
    } catch {
      /* silencieux : la boîte reste accessible */
    }
  }, [user]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    if (!socket || user?.role !== 'client') return undefined;
    const onOpportunity = (payload) => {
      if (!payload?.event) return;
      setCurrent({
        event: payload.event,
        channels: payload.channels || [],
        inboxId: payload.inboxId || null,
        distanceKm: payload.distanceKm ?? null,
        receivedAt: Date.now(),
      });
      setUnread((n) => n + 1);
    };
    socket.on('event:opportunity', onOpportunity);
    return () => {
      socket.off('event:opportunity', onOpportunity);
    };
  }, [socket, user?.role]);

  useEffect(() => {
    if (user?.role !== 'client') {
      setCurrent(null);
      setUnread(0);
    }
  }, [user?.role]);

  const value = useMemo(
    () => ({ current, dismiss, unread, refreshUnread }),
    [current, dismiss, unread, refreshUnread]
  );

  return <OpportunityContext.Provider value={value}>{children}</OpportunityContext.Provider>;
}

export function useOpportunity() {
  return useContext(OpportunityContext) || {
    current: null, dismiss: () => {}, unread: 0, refreshUnread: async () => {},
  };
}
