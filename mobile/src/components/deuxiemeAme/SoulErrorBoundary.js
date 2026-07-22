import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../theme';

/**
 * Filet de sécurité : un crash silencieux dans la Deuxième Âme produisait un
 * écran blanc. On affiche le message pour diagnostiquer sans bloquer la session.
 */
export default class SoulErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[DeuxiemeAme]', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>La Deuxième Âme a rencontré un problème</Text>
          <Text style={styles.msg}>{String(this.state.error?.message || this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: THEME.colors.bg },
  title: { fontSize: 18, fontWeight: '800', color: THEME.colors.text, marginBottom: 12 },
  msg: { fontSize: 13, color: THEME.colors.error, lineHeight: 20 },
});
