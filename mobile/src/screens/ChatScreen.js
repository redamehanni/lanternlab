import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { getConversationMessages, sendConversationMessage } from '../api';
import Avatar from '../components/Avatar';
import { COLORS } from '../config';

export default function ChatScreen({ route, navigation }) {
  const { user, socket } = useApp();
  const conversationId = route.params?.conversationId;
  const title = route.params?.title || 'Messages';

  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [typing,   setTyping]   = useState('');
  const listRef = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => { navigation.setOptions({ title }); }, [title, navigation]);

  const load = useCallback(async () => {
    try {
      const res = await getConversationMessages(conversationId);
      setMessages(res.data.messages || []);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la conversation.');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
    if (!socket) return;
    socket.emit('join:conversation', conversationId);

    const onNew = ({ message, conversationId: cid }) => {
      if (cid !== conversationId) return; // ne jamais mélanger les canaux (issue #8)
      setMessages(prev => prev.find(m => m.id === message.id) ? prev : [...prev, message]);
      setTyping('');
    };
    const onTyping = ({ name }) => {
      setTyping(`${name} est en train d'écrire…`);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(''), 2500);
    };

    socket.on('message:new', onNew);
    socket.on('chat:typing', onTyping);
    return () => {
      socket.emit('leave:conversation', conversationId);
      socket.off('message:new', onNew);
      socket.off('chat:typing', onTyping);
    };
  }, [socket, conversationId, load]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  function handleTyping() { socket?.emit('chat:typing', { conversationId }); }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      await sendConversationMessage(conversationId, text);
    } catch {
      Alert.alert('Erreur', 'Envoi impossible.');
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }) {
    const isMe = item.sender_id === user.id;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && <Avatar name={item.sender_name} photoUrl={item.sender_photo} role={item.sender_role} size={32} />}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, !isMe && { marginLeft: 8 }]}>
          {!isMe && <Text style={styles.senderName}>{item.sender_name}</Text>}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date((item.created_at || '') + 'Z').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {loading ? (
        <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>Aucun message.{'\n'}Démarrez la conversation.</Text>
            </View>
          }
          renderItem={renderMessage}
        />
      )}

      {typing ? <Text style={styles.typing}>{typing}</Text> : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(t) => { setInput(t); handleTyping(); }}
          placeholder="Votre message…"
          multiline maxLength={500} returnKeyType="send"
        />
        <TouchableOpacity style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend} disabled={!input.trim() || sending}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>Envoyer</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1 },
  list: { padding: 12, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 24 },
  msgRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  bubble: { maxWidth: '75%', borderRadius: 14, padding: 10, paddingHorizontal: 14 },
  bubbleOther: { backgroundColor: COLORS.card },
  bubbleMe: { backgroundColor: COLORS.primary },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 3, color: COLORS.textLight },
  msgText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 11, color: COLORS.textLight, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMe: { color: 'rgba(255,255,255,0.6)' },
  typing: { paddingHorizontal: 16, paddingVertical: 6, fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' },
  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card, alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: COLORS.border },
  sendBtn: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
