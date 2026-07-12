import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useCommunication } from '../context/CommunicationContext';
import { getCommunicationMessages, sendCommunicationMessage } from '../api';
import Avatar from '../components/Avatar';
import {
  getChatPresentationMode,
  getChatNavTitle,
  getChatPlaceholder,
  ChatBanner,
  getBubbleStyles,
} from '../components/chat/ChatPresentation';
import { COLORS } from '../config';

export default function ChatScreen({ route, navigation }) {
  const { user, socket } = useApp();
  const { setActiveConversation, markRead, registerThread } = useCommunication();
  const conversationId = route.params?.conversationId;
  const paramTitle = route.params?.title;
  const contextOrderId = route.params?.orderId;
  const paramLifecycle = route.params?.lifecycle;
  const paramKind = route.params?.kind;

  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [typing,   setTyping]   = useState('');
  const [threadMeta, setThreadMeta] = useState(null);
  const listRef = useRef(null);
  const typingTimer = useRef(null);

  const presentationMode = getChatPresentationMode(
    threadMeta?.lifecycle || paramLifecycle,
    threadMeta?.kind || paramKind,
  );
  const navTitle = getChatNavTitle(presentationMode);

  useEffect(() => {
    navigation.setOptions({ title: paramTitle && presentationMode === 'messaging' ? paramTitle : navTitle });
  }, [navTitle, paramTitle, presentationMode, navigation]);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setMessages([]);
    try {
      const res = await getCommunicationMessages(conversationId);
      setMessages(res.data.messages || []);
      const thread = res.data.thread || res.data.conversation;
      if (thread) {
        setThreadMeta(thread);
        registerThread(thread);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la conversation.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, registerThread]);

  useEffect(() => {
    if (!conversationId) return undefined;
    load();
    setActiveConversation(conversationId);
    if (!socket) return () => setActiveConversation(null);

    socket.emit('join:conversation', conversationId);

    const onNew = ({ message, conversationId: cid }) => {
      if (cid !== conversationId) return;
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
      setActiveConversation(null);
    };
  }, [socket, conversationId, load, setActiveConversation]);

  useFocusEffect(useCallback(() => {
    if (conversationId) markRead(conversationId);
  }, [conversationId, markRead]));

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  function handleTyping() { socket?.emit('chat:typing', { conversationId }); }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !conversationId) return;
    setSending(true);
    setInput('');
    try {
      await sendCommunicationMessage(conversationId, text, contextOrderId);
    } catch {
      Alert.alert('Erreur', 'Envoi impossible.');
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  if (!conversationId) {
    return (
      <View style={styles.bg}>
        <Text style={styles.errorText}>Conversation introuvable.</Text>
      </View>
    );
  }

  function renderMessage({ item }) {
    const isMe = item.sender_id === user.id;
    const { bubble, msgText } = getBubbleStyles(presentationMode, isMe);
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && <Avatar name={item.sender_name} photoUrl={item.sender_photo} role={item.sender_role} size={32} />}
        <View style={[...bubble, !isMe && { marginLeft: 8 }]}>
          {!isMe && <Text style={styles.senderName}>{item.sender_name}</Text>}
          {item.context_order_id ? (
            <Text style={styles.orderCtx}>Commande liée</Text>
          ) : null}
          <Text style={msgText}>{item.content}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date((item.created_at || '') + 'Z').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }

  const storeName = threadMeta?.party?.store?.name;

  return (
    <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ChatBanner mode={presentationMode} storeName={storeName} />

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
          placeholder={getChatPlaceholder(presentationMode)}
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
  errorText: { textAlign: 'center', marginTop: 40, color: COLORS.textLight },
  list: { padding: 12, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 24 },
  msgRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 3, color: COLORS.textLight },
  orderCtx: { fontSize: 10, color: COLORS.secondary, marginBottom: 4, fontWeight: '600' },
  msgTime: { fontSize: 11, color: COLORS.textLight, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMe: { color: 'rgba(255,255,255,0.6)' },
  typing: { paddingHorizontal: 16, paddingVertical: 6, fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' },
  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card, alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: COLORS.border },
  sendBtn: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
