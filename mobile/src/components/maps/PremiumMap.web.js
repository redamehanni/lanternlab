import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Image, StyleSheet, Animated, Text, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import MapMarkerPin from './MapMarkerPin';
import {
  TILE, clampZoom, tileUrl, panByPixels, tileLayerLayout,
} from './tileMath';

export default function PremiumMap({
  lat,
  lng,
  label,
  height = 180,
  style,
  fullScreen = false,
  markerColor = THEME.colors.accent,
}) {
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
  const containerStyle = fullScreen ? [styles.full, style] : [{ height }, style];
  const fade = useRef(new Animated.Value(0)).current;

  const [center, setCenter] = useState({ lat, lng });
  const [zoom, setZoom] = useState(14);
  const [bearing, setBearing] = useState(0);

  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const bearingRef = useRef(bearing);
  const panOrigin = useRef({ lat, lng });
  const pinchRef = useRef({ dist: 0, zoom: 14, angle: 0, bearing: 0 });

  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { bearingRef.current = bearing; }, [bearing]);

  useEffect(() => {
    if (!hasCoords) return;
    const next = { lat, lng };
    setCenter(next);
    panOrigin.current = next;
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [lat, lng, hasCoords, fade]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
    onPanResponderGrant: () => {
      panOrigin.current = centerRef.current;
    },
    onPanResponderMove: (_, g) => {
      const next = panByPixels(
        g.dx, g.dy,
        panOrigin.current.lat, panOrigin.current.lng,
        zoomRef.current,
      );
      setCenter(next);
    },
  }), []);

  const handleWheel = useCallback((e) => {
    e.preventDefault?.();
    const delta = e.nativeEvent?.deltaY ?? 0;
    setZoom((z) => clampZoom(z - delta * 0.002));
  }, []);

  const handleTouchStart = useCallback((e) => {
    const touches = e.nativeEvent.touches;
    if (touches?.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      pinchRef.current = {
        dist: Math.hypot(dx, dy),
        zoom: zoomRef.current,
        angle: Math.atan2(dy, dx),
        bearing: bearingRef.current,
      };
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    const touches = e.nativeEvent.touches;
    if (touches?.length !== 2) return;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const { dist: startDist, zoom: startZoom, angle: startAngle, bearing: startBearing } = pinchRef.current;
    if (startDist > 0) {
      const scale = dist / startDist;
      setZoom(clampZoom(startZoom + Math.log2(scale)));
      const deltaDeg = ((angle - startAngle) * 180) / Math.PI;
      setBearing(startBearing + deltaDeg);
    }
  }, []);

  const intZoom = Math.round(zoom);
  const radius = fullScreen ? 3 : 2;

  const layout = useMemo(() => {
    if (!hasCoords) return null;
    return tileLayerLayout(center.lat, center.lng, lat, lng, intZoom, radius);
  }, [hasCoords, center.lat, center.lng, lat, lng, intZoom, radius]);

  if (!hasCoords) {
    return (
      <View style={[styles.placeholder, containerStyle]}>
        <Ionicons name="map-outline" size={32} color={THEME.colors.textMuted} />
        <Text style={styles.placeholderText}>{label || 'Position non renseignée'}</Text>
      </View>
    );
  }

  const { cx, cy, layerSize, translateX, translateY, markerX, markerY } = layout;
  const grid = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      grid.push({ x: cx + dx, y: cy + dy, key: `${intZoom}-${cx + dx}-${cy + dy}` });
    }
  }

  return (
    <Animated.View
      style={[styles.frame, containerStyle, { opacity: fade }]}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.tileLayer,
          {
            width: layerSize,
            height: layerSize,
            marginLeft: -layerSize / 2,
            marginTop: -layerSize / 2,
            transform: [
              { translateX },
              { translateY },
              { rotate: `${bearing}deg` },
              { scale: 2 ** (zoom - intZoom) },
            ],
          },
        ]}
        pointerEvents="none"
      >
        {grid.map((t) => (
          <Image
            key={t.key}
            source={{ uri: tileUrl(intZoom, t.x, t.y) }}
            style={{
              position: 'absolute',
              left: (t.x - cx + radius) * TILE,
              top: (t.y - cy + radius) * TILE,
              width: TILE,
              height: TILE,
            }}
            resizeMode="cover"
          />
        ))}

        <View
          style={[styles.markerInLayer, { left: markerX - 16, top: markerY - 36 }]}
          pointerEvents="none"
        >
          <MapMarkerPin color={markerColor} />
        </View>
      </View>

      <View style={styles.vignette} pointerEvents="none" />
      {label ? <Text style={styles.label} pointerEvents="none">{label}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: '#EEF1F5',
    borderRadius: THEME.radius.lg,
    ...THEME.shadow.md,
    cursor: 'grab',
    userSelect: 'none',
  },
  full: { flex: 1, borderRadius: 0 },
  placeholder: {
    backgroundColor: '#EEF1F5',
    borderRadius: THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: { color: THEME.colors.textMuted, fontSize: 13 },
  tileLayer: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  markerInLayer: { position: 'absolute', zIndex: 2 },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248,250,252,0.06)',
  },
  label: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    backgroundColor: 'rgba(15,23,42,0.72)', color: '#fff',
    fontSize: 12, fontWeight: '600', padding: 8, borderRadius: THEME.radius.sm,
  },
});
