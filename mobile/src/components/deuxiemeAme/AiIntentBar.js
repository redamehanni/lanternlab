import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';
import { INTENT_SUGGESTIONS } from '../../data/deuxiemeAme';

/**
 * Barre d'intention de la Deuxième Âme.
 *
 * NOTE PRODUCTION : l'assistant conversationnel n'a pas encore d'organe. Les
 * suggestions branchées sur une projection (route) fonctionnent dès aujourd'hui ;
 * la saisie libre passe par `onAssist` qui, tant que l'IA n'existe pas, présente
 * un état honnête « Bientôt ». La structure est prête à recevoir l'organe IA.
 */
export default function AiIntentBar({ onSuggestion, onAssist }) {
  const [text, setText] = useState('');

  function submit() {
    const q = text.trim();
    if (!q) return;
    onAssist?.(q);
    setText('');
  }

  return (
    <View style={[styles.card, THEME.shadow.sm]}>
      <View style={styles.row}>
        <View style={styles.sparkle}>
          <Ionicons name="sparkles" size={16} color="#fff" />
        </View>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Une demande ou un objectif aujourd'hui ?"
          placeholderTextColor={THEME.colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={submit}
        />
        {text.trim() ? (
          <TouchableOpacity onPress={submit} style={styles.sendBtn} activeOpacity={0.85}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {INTENT_SUGGESTIONS.map((s) => (
          <TouchableOpacity key={s.id} style={styles.chip} onPress={() => onSuggestion?.(s)} activeOpacity={0.85}>
            <Text style={styles.chipText}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sparkle: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: THEME.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  input: { flex: 1, fontSize: 14.5, color: THEME.colors.text, paddingVertical: 6 },
  sendBtn: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: THEME.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  chips: { gap: 8, paddingTop: 12, paddingRight: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.accentSoft,
  },
  chipText: { fontSize: 12.5, fontWeight: '600', color: THEME.colors.accent },
});
