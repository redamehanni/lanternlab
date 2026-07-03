import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { THEME } from '../../theme';

export default function HelpCenterScreen() {
  const { user } = useApp();
  const [form, setForm] = useState({
    first_name: user.first_name || user.name?.split(' ')[0] || '',
    last_name: user.last_name || user.name?.split(' ').slice(1).join(' ') || '',
    email: user.email || '',
    subject: '',
    message: '',
  });

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  function handleSubmit() {
    if (!form.subject.trim() || !form.message.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir le sujet et le message.');
      return;
    }
    // Logique d'envoi future — pour l'instant confirmation locale
    Alert.alert(
      'Message enregistré',
      'Notre équipe vous répondra sous 24h. (Envoi automatique à venir)',
    );
    setForm((f) => ({ ...f, subject: '', message: '' }));
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Centre d'aide</Text>
      <Text style={styles.sub}>Une question ? Notre équipe est là pour vous.</Text>

      <View style={[styles.infoBox, THEME.shadow.sm]}>
        <Text style={styles.infoText}>📧 support@mazone.fr</Text>
        <Text style={styles.infoText}>⏱ Réponse sous 24h</Text>
      </View>

      <Text style={styles.label}>Prénom</Text>
      <TextInput style={styles.input} value={form.first_name} onChangeText={set('first_name')} />
      <Text style={styles.label}>Nom</Text>
      <TextInput style={styles.input} value={form.last_name} onChangeText={set('last_name')} />
      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Text style={styles.label}>Sujet</Text>
      <TextInput style={styles.input} value={form.subject} onChangeText={set('subject')} />
      <Text style={styles.label}>Message</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={form.message}
        onChangeText={set('message')}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
        <Text style={styles.submitText}>Envoyer ma demande</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.lg, paddingBottom: 100 },
  title: { ...THEME.typography.hero, fontSize: 28, color: THEME.colors.text },
  sub: { color: THEME.colors.textSecondary, marginBottom: THEME.spacing.lg },
  infoBox: {
    backgroundColor: THEME.colors.accentSoft, borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md, marginBottom: THEME.spacing.lg,
  },
  infoText: { color: THEME.colors.accent, fontWeight: '600', marginVertical: 2 },
  label: { fontSize: 13, fontWeight: '700', color: THEME.colors.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: THEME.colors.card, borderRadius: THEME.radius.md, borderWidth: 1,
    borderColor: THEME.colors.border, padding: 14, fontSize: 15, marginBottom: 4,
  },
  textarea: { minHeight: 120 },
  submitBtn: {
    backgroundColor: THEME.colors.primary, borderRadius: THEME.radius.md,
    padding: 18, alignItems: 'center', marginTop: 20,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
