import { Alert } from 'react-native';
import { resolveCommunicationThread } from '../api';

/**
 * Point d'entrée unique vers ChatScreen — tous rôles, tous types.
 */
export async function openCommunication(navigation, {
  orderId,
  storeId,
  targetRole,
  title,
  contextOrderId,
}, { registerThread } = {}) {
  try {
    const body = { target_role: targetRole };
    if (orderId) body.order_id = orderId;
    if (storeId) body.store_id = storeId;

    const res = await resolveCommunicationThread(body);
    const thread = res.data.thread || res.data.conversation;
    registerThread?.(thread);

    const displayTitle = title
      || thread.displayName
      || thread.party?.store?.name
      || thread.other?.name
      || 'Messages';

    navigation.push('Chat', {
      conversationId: thread.id,
      title: displayTitle,
      kind: thread.kind,
      lifecycle: thread.lifecycle,
      storeId: thread.store_id,
      orderId: contextOrderId || orderId,
    });
  } catch (err) {
    Alert.alert('Indisponible', err.response?.data?.error || 'Conversation non disponible.');
    throw err;
  }
}
