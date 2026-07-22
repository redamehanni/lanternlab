import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getEventMurmurs } from '../../api';
import { timeAgo } from '../../utils/format';
import { THEME } from '../../theme';

/**
 * « Les murmures du quartier » — projection poétique (listMurmurs). Vue plein
 * écran de la section d'accueil. Présentationnel uniquement.
 */
export default function MurmursScreen({ navigation }) {
  const [murmurs, setMurmurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getEventMurmurs();
      setMurmurs(res.data.events || []);
    } catch {
      setMurmurs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ActivityIndicator style={styles.center} color={THEME.colors.accent} />;

  return (
    <FlatList
      style={styles.bg}
      data={murmurs}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={<Text style={styles.intro}>Les petits riens qui font la poésie du quartier.</Text>}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="sparkles-outline" size={40} color={THEME.colors.textMuted} />
          <Text style={styles.emptyText}>Aucun murmure pour l'instant</Text>
        </View>
      }
      renderItem={({ item }) => {
        const d = item.display || {};
        const text = d.subtitle || d.title || item.title || item.summary;
        const when = item.startsAt || item.createdAt;
        return (
          <TouchableOpacity style={[styles.card, THEME.shadow.sm]} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} activeOpacity={0.9}>
            <View style={styles.iconWrap}><Ionicons name="sparkles-outline" size={16} color={THEME.colors.accent} /></View>
            <View style={styles.body}>
              <Text style={styles.text}>{text}</Text>
              {when ? <Text style={styles.time}>{timeAgo(when)}</Text> : null}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1 },
  list: { padding: THEME.spacing.md, paddingBottom: 40, flexGrow: 1 },
  intro: { color: THEME.colors.textSecondary, fontSize: 14, marginBottom: 14 },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: THEME.colors.card, borderRadius: THEME.radius.lg,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: THEME.colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1 },
  text: { fontSize: 14.5, color: THEME.colors.text, lineHeight: 20, fontWeight: '500' },
  time: { fontSize: 11.5, color: THEME.colors.textMuted, marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: THEME.colors.text, fontWeight: '700', marginTop: 12, fontSize: 16 },
});
