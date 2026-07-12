import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from './AppContext';
import {
  getCommunicationThreads,
  markCommunicationRead,
} from '../api';

const CommunicationContext = createContext(null);

function threadKey(orderId, kind) {
  return `${orderId}:${kind}`;
}

export function CommunicationProvider({ children }) {
  const { user, socket } = useApp();
  const [threads, setThreads] = useState({});
  const activeConversationId = useRef(null);

  const loadThreads = useCallback(async (filters = {}) => {
    if (!user) return;
    try {
      const res = await getCommunicationThreads(filters);
      const list = res.data.threads || res.data.conversations || [];
      const map = {};
      for (const t of list) {
        map[t.id] = t;
      }
      setThreads((prev) => ({ ...prev, ...map }));
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    if (user) loadThreads();
  }, [user, loadThreads]);

  useEffect(() => {
    if (!socket || !user) return;

    const onUpdated = ({ conversationId, unreadCount }) => {
      if (conversationId === activeConversationId.current) return;
      setThreads((prev) => {
        const cur = prev[conversationId];
        if (!cur) {
          loadThreads();
          return prev;
        }
        return {
          ...prev,
          [conversationId]: {
            ...cur,
            unread_count: unreadCount ?? (cur.unread_count || 0) + 1,
          },
        };
      });
    };

    const onNew = ({ message, conversationId }) => {
      if (!conversationId || message?.sender_id === user.id) return;
      if (conversationId === activeConversationId.current) return;
      setThreads((prev) => {
        const cur = prev[conversationId];
        if (!cur) {
          loadThreads();
          return prev;
        }
        return {
          ...prev,
          [conversationId]: {
            ...cur,
            unread_count: (cur.unread_count || 0) + 1,
            last_message: message.content,
            last_at: message.created_at,
          },
        };
      });
    };

    socket.on('conversation:updated', onUpdated);
    socket.on('message:new', onNew);
    return () => {
      socket.off('conversation:updated', onUpdated);
      socket.off('message:new', onNew);
    };
  }, [socket, user, loadThreads]);

  const registerThread = useCallback((thread) => {
    if (!thread?.id) return;
    setThreads((prev) => ({ ...prev, [thread.id]: { ...prev[thread.id], ...thread } }));
  }, []);

  const setActiveConversation = useCallback((id) => {
    activeConversationId.current = id;
  }, []);

  const markRead = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      await markCommunicationRead(conversationId);
      setThreads((prev) => ({
        ...prev,
        [conversationId]: prev[conversationId]
          ? { ...prev[conversationId], unread_count: 0 }
          : prev[conversationId],
      }));
    } catch {
      /* ignore */
    }
  }, []);

  const getUnread = useCallback((conversationId) => {
    return threads[conversationId]?.unread_count || 0;
  }, [threads]);

  const getUnreadForStore = useCallback((storeId) => {
    const t = Object.values(threads).find(
      (x) => x.store_id === storeId && x.kind === 'client_merchant' && x.lifecycle === 'durable'
    );
    return t?.unread_count || 0;
  }, [threads]);

  const getUnreadForOrder = useCallback((orderId, kind) => {
    const t = Object.values(threads).find(
      (x) => x.order_id === orderId && x.kind === kind && x.status !== 'archived'
    );
    return t?.unread_count || 0;
  }, [threads]);

  const getThreadForStore = useCallback((storeId) => {
    return Object.values(threads).find(
      (x) => x.store_id === storeId && x.kind === 'client_merchant'
    );
  }, [threads]);

  const getThreadForOrder = useCallback((orderId, kind) => {
    return Object.values(threads).find((x) => x.order_id === orderId && x.kind === kind);
  }, [threads]);

  const getUnreadForClientOnStore = useCallback((storeId, clientId) => {
    const t = Object.values(threads).find(
      (x) => x.store_id === storeId && x.kind === 'client_merchant'
        && (x.other?.id === clientId || x.conversation?.user_a === clientId)
    );
    return t?.unread_count || 0;
  }, [threads]);

  const getTotalUnreadMessagingTab = useCallback(() => {
    return Object.values(threads).reduce((sum, t) => {
      if (t.kind === 'client_merchant' && t.lifecycle === 'durable' && t.status !== 'archived') {
        return sum + (t.unread_count || 0);
      }
      if (t.kind === 'support' && t.status !== 'archived') {
        return sum + (t.unread_count || 0);
      }
      return sum;
    }, 0);
  }, [threads]);

  const value = useMemo(() => ({
    threads,
    loadThreads,
    registerThread,
    setActiveConversation,
    markRead,
    getUnread,
    getUnreadForStore,
    getUnreadForOrder,
    getUnreadForClientOnStore,
    getThreadForStore,
    getThreadForOrder,
    getTotalUnreadMessagingTab,
    threadKey,
  }), [
    threads, loadThreads, registerThread, setActiveConversation, markRead,
    getUnread, getUnreadForStore, getUnreadForOrder, getUnreadForClientOnStore,
    getThreadForStore, getThreadForOrder, getTotalUnreadMessagingTab,
  ]);

  return (
    <CommunicationContext.Provider value={value}>
      {children}
    </CommunicationContext.Provider>
  );
}

export function useCommunication() {
  return useContext(CommunicationContext);
}
