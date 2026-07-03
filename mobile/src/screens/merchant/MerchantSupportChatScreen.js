import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { getMerchantSupportMessages, sendMerchantSupportMessage } from '../../api';
import { useApp } from '../../context/AppContext';
import { THEME } from '../../theme';

export default function MerchantSupportChatScreen({ route }) {
  const { user } = useApp();
  const threadId = route.params?.threadId;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const load = useCallback(async () => {
    if (!threadId) return;
    const res = await getMerchantSupportMessages(threadId);
    setMessages(res.data.messages || []);
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!text.trim() || !threadId) return;
    const content = text.trim();
    setText('');
    try {
      const res = await sendMerchantSupportMessage(threadId, content);
      setMessages((prev) => [...prev, res.data.message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { /* ignore */ }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.sender_id === user.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.content}</Text>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Votre message…"
          placeholderTextColor={THEME.colors.textMuted}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendText}>Envoyer</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.bg },
  list: { padding: THEME.spacing.md, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: THEME.radius.md, padding: 12, marginBottom: 8 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: THEME.colors.accent },
  bubbleOther: {
    alignSelf: 'flex-start', backgroundColor: THEME.colors.card,
    borderWidth: 1, borderColor: THEME.colors.borderLight,
  },
  bubbleText: { color: THEME.colors.text, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: THEME.spacing.md,
    borderTopWidth: 1, borderTopColor: THEME.colors.borderLight, backgroundColor: THEME.colors.card,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100, backgroundColor: THEME.colors.bg,
    borderRadius: THEME.radius.md, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: THEME.colors.text,
  },
  sendBtn: {
    marginLeft: 8, backgroundColor: THEME.colors.accent, borderRadius: THEME.radius.md,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  sendText: { color: '#fff', fontWeight: '700' },
});
