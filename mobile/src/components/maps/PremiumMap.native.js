import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import MapMarkerPin from './MapMarkerPin';
import { PREMIUM_MAP_STYLE, regionFromCoords } from './mapStyles';

export default function PremiumMap({
  lat,
  lng,
  label,
  height = 180,
  style,
  fullScreen = false,
  markerColor = THEME.colors.accent,
  onMarkerPress,
}) {
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const centeredRef = useRef(null);
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  useEffect(() => {
    if (!hasCoords || !ready) return;
    const key = `${lat?.toFixed(5)},${lng?.toFixed(5)}`;
    if (centeredRef.current === key) return;
    centeredRef.current = key;
    mapRef.current?.animateToRegion(regionFromCoords(lat, lng), 500);
  }, [lat, lng, hasCoords, ready]);

  if (!hasCoords) {
    return (
      <View style={[styles.placeholder, fullScreen ? styles.full : { height }, style]}>
        <Ionicons name="map-outline" size={32} color={THEME.colors.textMuted} />
        <Text style={styles.placeholderText}>{label || 'Position non renseignée'}</Text>
      </View>
    );
  }

  const region = regionFromCoords(lat, lng);
  const sizeStyle = fullScreen ? styles.full : (height != null ? { height } : { flex: 1, minHeight: 200 });

  return (
    <Animated.View
      style={[styles.frame, sizeStyle, style, { opacity: fade }]}
      collapsable={false}
    >
      <MapView
        ref={mapRef}
        style={[StyleSheet.absoluteFill, styles.map]}
        provider={PROVIDER_DEFAULT}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={Platform.OS === 'android' ? PREMIUM_MAP_STYLE : undefined}
        initialRegion={region}
        rotateEnabled
        pitchEnabled
        zoomEnabled
        scrollEnabled
        showsCompass
        showsUserLocation={false}
        onMapReady={() => setReady(true)}
      >
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          anchor={{ x: 0.5, y: 1 }}
          onPress={onMarkerPress}
        >
          <MapMarkerPin color={markerColor} />
        </Marker>
      </MapView>
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
    zIndex: 0,
  },
  map: { zIndex: 0 },
  full: { flex: 1, borderRadius: 0 },
  placeholder: {
    backgroundColor: '#EEF1F5',
    borderRadius: THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: { color: THEME.colors.textMuted, fontSize: 13 },
  label: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    backgroundColor: 'rgba(15,23,42,0.72)', color: '#fff',
    fontSize: 12, fontWeight: '600', padding: 8, borderRadius: THEME.radius.sm,
  },
});
