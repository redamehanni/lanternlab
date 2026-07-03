import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';

export default function SearchBar({
  value, onChangeText, onSubmit, placeholder = 'Que recherchez-vous dans votre zone ?',
  autoFocus = false, showBack = false, onBack,
}) {
  return (
    <View style={styles.row}>
      {showBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color={THEME.colors.accent} />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
      )}
      <View style={[styles.wrap, THEME.shadow.float, showBack && styles.wrapWithBack]}>
        <Ionicons name="search" size={22} color={THEME.colors.textMuted} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={THEME.colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          autoCapitalize="none"
          autoFocus={autoFocus}
        />
        {value?.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')} style={styles.clear}>
            <Ionicons name="close-circle" size={20} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: THEME.spacing.md, marginTop: THEME.spacing.md },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 10, alignSelf: 'flex-start',
    paddingVertical: 4, paddingRight: 8,
  },
  backText: { color: THEME.colors.accent, fontWeight: '700', fontSize: 15 },
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  wrapWithBack: { marginTop: 0 },
  icon: { marginRight: 10 },
  input: {
    flex: 1, fontSize: 16, color: THEME.colors.text, fontWeight: '500',
  },
  clear: { padding: 4 },
});
