import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AME } from '../../theme';

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
  wrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: AME.colors.bg },
  title: {
    fontFamily: AME.fonts.display,
    fontSize: 22,
    color: AME.colors.text,
    marginBottom: 12,
  },
  msg: {
    fontFamily: AME.fonts.ui,
    fontSize: 13.5,
    color: AME.colors.error,
    lineHeight: 20,
  },
});
