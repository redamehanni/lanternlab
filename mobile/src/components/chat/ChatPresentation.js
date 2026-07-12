import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../config';

export function getChatPresentationMode(lifecycle, kind) {
  if (lifecycle === 'ephemeral' || kind === 'client_driver' || kind === 'merchant_driver') {
    return 'mission_chat';
  }
  return 'messaging';
}

export function getChatNavTitle(mode) {
  return mode === 'mission_chat' ? 'Chat de mission' : 'Messagerie';
}

export function getChatPlaceholder(mode) {
  return mode === 'mission_chat'
    ? 'Message pour cette livraison…'
    : 'Votre message…';
}

export function ChatBanner({ mode, storeName }) {
  if (mode === 'mission_chat') {
    return (
      <View style={styles.ephemeralBanner}>
        <Text style={styles.ephemeralBannerText}>
          Messages éphémères · liés à cette livraison
        </Text>
      </View>
    );
  }
  if (storeName) {
    return (
      <View style={styles.storeBanner}>
        <Text style={styles.storeBannerText}>{storeName}</Text>
      </View>
    );
  }
  return null;
}

export function getBubbleStyles(mode, isMe) {
  if (mode === 'mission_chat') {
    return {
      bubble: [
        styles.bubbleBase,
        isMe ? styles.bubbleMeEphemeral : styles.bubbleOtherEphemeral,
      ],
      msgText: [styles.msgText, isMe && styles.msgTextMe],
    };
  }
  return {
    bubble: [
      styles.bubbleBase,
      isMe ? styles.bubbleMe : styles.bubbleOther,
    ],
    msgText: [styles.msgText, isMe && styles.msgTextMe],
  };
}

const styles = StyleSheet.create({
  storeBanner: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  storeBannerText: { fontSize: 13, fontWeight: '700', color: '#166534' },
  ephemeralBanner: {
    backgroundColor: '#fffbeb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  ephemeralBannerText: { fontSize: 13, fontWeight: '600', color: '#92400e', textAlign: 'center' },
  bubbleBase: { maxWidth: '75%', borderRadius: 14, padding: 10, paddingHorizontal: 14 },
  bubbleOther: { backgroundColor: COLORS.card },
  bubbleMe: { backgroundColor: COLORS.primary },
  bubbleOtherEphemeral: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
  },
  bubbleMeEphemeral: {
    backgroundColor: 'rgba(37, 99, 235, 0.88)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  msgText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  msgTextMe: { color: '#fff' },
});
