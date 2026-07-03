import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { appStorage } from '../utils/storage';
import { useApp } from './AppContext';
import {
  getDriverBroadcast, getDriverOnline, setDriverOnline,
  getMyMissions, getDriverNotifications,
} from '../api';

const DriverContext = createContext(null);
const ONLINE_KEY = 'driver_online';

export function DriverProvider({ children }) {
  const { user, socket } = useApp();
  const [online, setOnline] = useState(false);
  const [broadcast, setBroadcast] = useState(null);
  const [activeMission, setActiveMission] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [chatUnread, setChatUnread] = useState(false);
  const [ready, setReady] = useState(false);
  const assignedHandlerRef = useRef(null);

  const syncOnline = useCallback(async (value) => {
    setOnline(value);
    await appStorage.setItem(ONLINE_KEY, value ? '1' : '0');
    let mission = null;
    try {
      const res = await setDriverOnline(value);
      mission = value ? (res.data?.mission || res.data?.assigned?.mission || null) : null;
    } catch { /* offline ok */ }
    if (socket) socket.emit(value ? 'driver:online' : 'driver:offline');
    if (mission) {
      setActiveMission(mission);
      assignedHandlerRef.current?.(mission);
    }
    return mission;
  }, [socket]);

  const onMissionAssigned = useCallback((handler) => {
    assignedHandlerRef.current = handler;
    if (handler && activeMission) {
      handler(activeMission);
    }
  }, [activeMission]);

  const load = useCallback(async () => {
    if (user?.role !== 'driver') return;
    try {
      const [saved, onlineRes, broadcastRes, missionsRes, notifRes] = await Promise.all([
        appStorage.getItem(ONLINE_KEY),
        getDriverOnline().catch(() => ({ data: { online: false } })),
        getDriverBroadcast().catch(() => ({ data: { message: null } })),
        getMyMissions().catch(() => ({ data: { active: null } })),
        getDriverNotifications().catch(() => ({ data: { notifications: [] } })),
      ]);
      const isOnline = saved != null ? saved === '1' : !!onlineRes.data.online;
      setOnline(isOnline);
      if (socket && isOnline) socket.emit('driver:online');
      else if (socket) socket.emit('driver:offline');
      setBroadcast(broadcastRes.data.message);
      const active = missionsRes.data.active || null;
      setActiveMission(active);
      if (active) assignedHandlerRef.current?.(active);
      setNotifications(notifRes.data.notifications || []);
    } finally {
      setReady(true);
    }
  }, [user?.role, socket]);

  useEffect(() => {
    if (user?.role === 'driver') load();
  }, [user?.role, load]);

  useEffect(() => {
    if (!socket || user?.role !== 'driver') return;
    const onMsg = () => setChatUnread(true);
    const onAssigned = ({ mission }) => {
      setActiveMission(mission);
      assignedHandlerRef.current?.(mission);
    };
    const onCancelled = ({ missionId }) => {
      setActiveMission((cur) => (cur?.id === missionId ? null : cur));
    };
    socket.on('message:new', onMsg);
    socket.on('mission:assigned', onAssigned);
    socket.on('mission:cancelled', onCancelled);
    return () => {
      socket.off('message:new', onMsg);
      socket.off('mission:assigned', onAssigned);
      socket.off('mission:cancelled', onCancelled);
    };
  }, [socket, user?.role]);

  return (
    <DriverContext.Provider value={{
      online,
      setOnline: syncOnline,
      broadcast,
      activeMission,
      setActiveMission,
      notifications,
      setNotifications,
      chatUnread,
      setChatUnread,
      ready,
      refresh: load,
      onMissionAssigned,
    }}>
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  return useContext(DriverContext);
}
