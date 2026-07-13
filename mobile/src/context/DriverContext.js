import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { appStorage } from '../utils/storage';
import { useApp } from './AppContext';
import {
  getDriverBroadcast, getDriverOnline, setDriverOnline,
  getMyMissions, getDriverNotifications, getOfferedMission,
} from '../api';

const DriverContext = createContext(null);
const ONLINE_KEY = 'driver_online';

const ACTIVE_MISSION_STATUSES = ['accepted', 'picking_up', 'picked_up', 'delivering'];

function isActiveMission(mission) {
  return mission && ACTIVE_MISSION_STATUSES.includes(mission.status);
}

function applyPendingOffer(setPendingOffer, payload) {
  if (payload?.mission && payload?.offer) {
    setPendingOffer({ mission: payload.mission, offer: payload.offer });
    return true;
  }
  return false;
}

export function DriverProvider({ children }) {
  const { user, socket } = useApp();
  const [online, setOnline] = useState(false);
  const [broadcast, setBroadcast] = useState(null);
  const [activeMission, setActiveMission] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [pendingOffer, setPendingOffer] = useState(null);
  const [ready, setReady] = useState(false);
  const assignedHandlerRef = useRef(null);
  const activeMissionRef = useRef(null);

  activeMissionRef.current = activeMission;

  const clearPendingOffer = useCallback(() => setPendingOffer(null), []);

  const loadOfferIfOnline = useCallback(async (isOnline) => {
    if (!isOnline) {
      setPendingOffer(null);
      return;
    }
    try {
      const res = await getOfferedMission();
      if (res.data?.mission && res.data?.offer && !activeMissionRef.current) {
        setPendingOffer({ mission: res.data.mission, offer: res.data.offer });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const syncOnline = useCallback(async (value) => {
    setOnline(value);
    await appStorage.setItem(ONLINE_KEY, value ? '1' : '0');
    let mission = null;
    try {
      const res = await setDriverOnline(value);
      if (value) {
        if (applyPendingOffer(setPendingOffer, res.data?.offered)) {
          mission = null;
        } else {
          mission = res.data?.mission || res.data?.assigned?.mission || null;
          if (!isActiveMission(mission)) mission = null;
        }
      } else {
        setPendingOffer(null);
      }
    } catch { /* offline ok */ }
    if (socket) socket.emit(value ? 'driver:online' : 'driver:offline');
    if (mission) {
      setActiveMission(mission);
      setPendingOffer(null);
      assignedHandlerRef.current?.(mission);
    } else if (value) {
      await loadOfferIfOnline(true);
    }
    return mission;
  }, [socket, loadOfferIfOnline]);

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
      if (isActiveMission(active)) {
        setActiveMission(active);
        setPendingOffer(null);
        assignedHandlerRef.current?.(active);
      } else {
        setActiveMission(null);
        if (isOnline) await loadOfferIfOnline(true);
      }
      setNotifications(notifRes.data.notifications || []);
    } finally {
      setReady(true);
    }
  }, [user?.role, socket, loadOfferIfOnline]);

  useEffect(() => {
    if (user?.role === 'driver') load();
  }, [user?.role, load]);

  useEffect(() => {
    if (!socket || user?.role !== 'driver') return;
    const onAssigned = ({ mission }) => {
      if (!isActiveMission(mission)) return;
      setActiveMission(mission);
      setPendingOffer(null);
      assignedHandlerRef.current?.(mission);
    };
    const onOffered = ({ mission, offer }) => {
      if (activeMissionRef.current) return;
      setPendingOffer({ mission, offer });
    };
    const onCancelled = ({ missionId }) => {
      setActiveMission((cur) => (cur?.id === missionId ? null : cur));
      setPendingOffer((cur) => (cur?.mission?.id === missionId ? null : cur));
    };
    socket.on('mission:assigned', onAssigned);
    socket.on('mission:offered', onOffered);
    socket.on('mission:cancelled', onCancelled);
    return () => {
      socket.off('mission:assigned', onAssigned);
      socket.off('mission:offered', onOffered);
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
      pendingOffer,
      clearPendingOffer,
      notifications,
      setNotifications,
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
