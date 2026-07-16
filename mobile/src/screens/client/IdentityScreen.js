import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useApp } from '../../context/AppContext';
import { getIdentityToken } from '../../api';
import Avatar from '../../components/Avatar';
import FadeIn from '../../components/ui/FadeIn';
import { THEME } from '../../theme';

/**
 * Identity Engine — Présentation d'identité (canal QR).
 *
 * L'écran demande un jeton neutre au backend et l'encode en QR. Le jeton tourne
 * automatiquement (rotation) et à chaque ouverture. Le QR n'est qu'un canal :
 * l'identité et sa sécurité vivent côté serveur.
 */
export default function IdentityScreen({ navigation }) {
  const { user } = useApp();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await getIdentityToken();
      setToken(res.data);
      return res.data;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function cycle() {
      const data = await load();
      if (cancelled) return;
      const rotateMs = Math.max((data?.rotateSeconds || 45), 15) * 1000;
      timer.current = setTimeout(cycle, rotateMs);
    }
    cycle();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const displayName = user?.first_name || user?.name || 'Mon identité';

  return (
    <View style={[styles.bg, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} activeOpacity={0.8} accessibilityLabel="Fermer">
          <Ionicons name="chevron-down" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Mon identité</Text>
        <View style={styles.closeBtn} />
      </View>

      <FadeIn style={styles.center}>
        <View style={styles.identityHeader}>
          <Avatar name={user?.name} photoUrl={user?.photo_url} role={user?.role} size={72} />
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.subtitle}>Présentez ce code pour être identifié</Text>
        </View>

        <View style={styles.qrCard}>
          {loading && !token ? (
            <ActivityIndicator color={THEME.colors.accent} />
          ) : error ? (
            <View style={styles.qrFallback}>
              <Ionicons name="cloud-offline-outline" size={40} color={THEME.colors.textMuted} />
              <Text style={styles.errorText}>Connexion requise</Text>
              <TouchableOpacity onPress={load} style={styles.retryBtn} activeOpacity={0.85}>
                <Text style={styles.retryText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <QRCode
              value={token.handle}
              size={230}
              backgroundColor="#FFFFFF"
              color={THEME.colors.primary}
            />
          )}
        </View>

        <View style={styles.hintRow}>
          <Ionicons name="sync-outline" size={15} color={THEME.colors.textMuted} />
          <Text style={styles.hint}>Ce code se renouvelle automatiquement pour votre sécurité</Text>
        </View>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.primary },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: THEME.spacing.md },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: THEME.spacing.lg, paddingBottom: 40 },
  identityHeader: { alignItems: 'center', marginBottom: THEME.spacing.xl },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 14 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 6 },
  qrCard: {
    width: 286, height: 286, borderRadius: THEME.radius.xl, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', ...THEME.shadow.lg,
  },
  qrFallback: { alignItems: 'center', gap: 10 },
  errorText: { color: THEME.colors.textSecondary, fontSize: 14, fontWeight: '600' },
  retryBtn: { marginTop: 6, backgroundColor: THEME.colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: THEME.radius.full },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: THEME.spacing.xl, paddingHorizontal: 20 },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, textAlign: 'center', flexShrink: 1 },
});
