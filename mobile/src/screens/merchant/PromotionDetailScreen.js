import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { updatePromotion } from '../../api';
import { euro } from '../../utils/format';
import { THEME } from '../../theme';

export default function PromotionDetailScreen({ navigation, route }) {
  const [promo, setPromo] = useState(route.params.promo);
  const [discountPercent, setDiscountPercent] = useState(String(promo.discount_percent || ''));
  const [maxQty, setMaxQty] = useState(String(promo.max_quantity || ''));
  const [remaining, setRemaining] = useState(String(promo.remaining_quantity ?? promo.max_quantity ?? ''));
  const [endsAt, setEndsAt] = useState(promo.ends_at || '');
  const [active, setActive] = useState(!!promo.active);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await updatePromotion(promo.id, {
        discount_percent: promo.type === 'discount' ? parseFloat(discountPercent) : undefined,
        max_quantity: maxQty ? parseInt(maxQty, 10) : undefined,
        remaining_quantity: remaining ? parseInt(remaining, 10) : undefined,
        ends_at: endsAt || undefined,
        active,
      });
      setPromo(res.data.promotion);
      Alert.alert('Promotion mise à jour');
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Mise à jour impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{promo.product_name}</Text>
      <Text style={styles.type}>
        {promo.type === 'discount' ? 'Remise en pourcentage' : `Offre : ${promo.get_quantity} offert(s) pour ${promo.buy_quantity} acheté(s)`}
      </Text>

      {promo.type === 'discount' && (
        <>
          <Text style={styles.label}>Pourcentage</Text>
          <TextInput style={styles.input} value={discountPercent} onChangeText={setDiscountPercent} keyboardType="numeric" />
          <Text style={styles.preview}>
            Prix : {euro(promo.original_price)} → {euro(promo.promo_price)}
          </Text>
        </>
      )}

      <Text style={styles.label}>Nombre max d'articles</Text>
      <TextInput style={styles.input} value={maxQty} onChangeText={setMaxQty} keyboardType="numeric" />

      <Text style={styles.label}>Stock promotionnel restant</Text>
      <TextInput style={styles.input} value={remaining} onChangeText={setRemaining} keyboardType="numeric" />

      <Text style={styles.label}>Date et heure de fin</Text>
      <TextInput style={styles.input} value={endsAt} onChangeText={setEndsAt} placeholder="YYYY-MM-DD HH:MM" />

      <View style={styles.switchRow}>
        <Text style={styles.label}>Promotion active</Text>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: THEME.colors.success }} />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, paddingBottom: 60 },
  title: { ...THEME.typography.hero, fontSize: 24, color: THEME.colors.text },
  type: { color: THEME.colors.textSecondary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: THEME.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: THEME.colors.card, borderRadius: 12, borderWidth: 1,
    borderColor: THEME.colors.border, padding: 14, fontSize: 15,
  },
  preview: { fontSize: 14, color: THEME.colors.text, marginTop: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  saveBtn: {
    backgroundColor: THEME.colors.primary, borderRadius: 14, padding: 18,
    alignItems: 'center', marginTop: 28,
  },
  saveText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
