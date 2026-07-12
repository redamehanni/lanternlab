const engine = require('./communicationEngine');
const policies = require('./communicationPolicies');

/**
 * Compatibilité legacy — délègue au moteur Communication.
 */
function getOrCreateConversation(orderId, kind, userA, userB) {
  if (kind === 'client_merchant') {
    const order = policies.getOrderContext(orderId);
    if (!order) return null;
    const clientId = userA;
    return engine.resolveDurableClientMerchant(clientId, order.store_id, userB, orderId);
  }
  const userMin = userA < userB ? userA : userB;
  const userMax = userA < userB ? userB : userA;
  try {
    return engine.resolveEphemeral(orderId, kind, userMin, userMax);
  } catch {
    return null;
  }
}

module.exports = { getOrCreateConversation };
