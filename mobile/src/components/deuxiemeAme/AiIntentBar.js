import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AME } from '../../theme';
import { INTENT_SUGGESTIONS } from '../../data/deuxiemeAme';
import SoftIcon from '../ui/SoftIcon';

/**
 * Barre d'intention — carte crème, sparkle discret, pas de look chatbot SaaS.
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
    <View style={[styles.card, AME.shadow.sm]}>
      <View style={styles.row}>
        <SoftIcon name="sparkle" size={16} wellSize={36} color={AME.colors.accentDeep} wellColor={AME.colors.accentSoft} radius={12} />
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Une demande ou un objectif aujourd'hui ?"
          placeholderTextColor={AME.colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={submit}
        />
        {text.trim() ? (
          <TouchableOpacity onPress={submit} style={styles.sendBtn} activeOpacity={0.85}>
            <Ionicons name="arrow-up" size={18} color={AME.colors.textOnAccent} />
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
    backgroundColor: AME.colors.card,
    borderRadius: AME.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: AME.fonts.ui,
    color: AME.colors.text,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: AME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: 8, paddingTop: 14, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: AME.radius.full,
    backgroundColor: AME.colors.paper,
    borderWidth: 1,
    borderColor: AME.colors.borderLight,
  },
  chipText: {
    fontSize: 13,
    fontFamily: AME.fonts.uiMedium,
    color: AME.colors.textSecondary,
  },
});
