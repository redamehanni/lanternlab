import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useApp } from './AppContext';

/**
 * Opportunité Volante — écoute temps réel côté habitant.
 *
 * L'organe (Event Engine) diffuse activement une initiative vers les habitants
 * abonnés via le socket `event:opportunity` (rooms `user_<id>` déjà en place).
 * Cette surface se contente d'écouter et d'exposer la dernière opportunité pour
 * qu'une bannière la présente. Aucune logique métier : l'organe décide qui reçoit.
 *
 * Pattern d'abonnement calqué sur WalletContext (source unique de vérité socket).
 */
const OpportunityContext = createContext(null);

export function OpportunityProvider({ children }) {
  const { user, socket } = useApp();
  const [current, setCurrent] = useState(null);

  const dismiss = useCallback(() => setCurrent(null), []);

  useEffect(() => {
    if (!socket || user?.role !== 'client') return undefined;
    const onOpportunity = (payload) => {
      if (!payload?.event) return;
      setCurrent({ event: payload.event, channels: payload.channels || [], receivedAt: Date.now() });
    };
    socket.on('event:opportunity', onOpportunity);
    return () => {
      socket.off('event:opportunity', onOpportunity);
    };
  }, [socket, user?.role]);

  // La bannière ne concerne que les habitants : on nettoie si le rôle change.
  useEffect(() => {
    if (user?.role !== 'client') setCurrent(null);
  }, [user?.role]);

  const value = useMemo(() => ({ current, dismiss }), [current, dismiss]);

  return <OpportunityContext.Provider value={value}>{children}</OpportunityContext.Provider>;
}

export function useOpportunity() {
  return useContext(OpportunityContext) || { current: null, dismiss: () => {} };
}
