/**
 * Organe Orders — façade.
 *
 * Une seule porte d'entrée pour les routes et les autres organes. Personne
 * n'importe `orderEngine` directement depuis une route.
 *
 * Cette façade expose les DÉCISIONS de l'organe (créer, transiter, annuler). Les
 * enchaînements qui traversent plusieurs organes ne sont plus ici depuis l'étape 5 :
 * ce sont des intentions, formulées via `lib/orchestration`.
 *
 * `getFullOrder` est réexporté à l'identique : c'est l'ancien `lib/orders.js`, et
 * les appelants historiques (`lib/dispatch.js`, `routes/orders.js`) continuent de
 * fonctionner sans modification puisque `require('../lib/orders')` résout
 * désormais vers ce fichier.
 */

const lifecycle = require('./lifecycle');
const orderEngine = require('./orderEngine');
const placement = require('./placement');
const { getFullOrder, listOrders } = require('./projection');
const { orderJournal, ORDER_JOURNAL_TYPE } = require('./orderJournal');
const { registerOrderSubscribers } = require('./subscribers');

module.exports = {
  getFullOrder,
  listOrders,

  createOrder: orderEngine.createOrder,
  transitionOrder: orderEngine.transitionOrder,
  cancelOrder: orderEngine.cancelOrder,
  getOrder: orderEngine.getOrder,
  getOrderRow: orderEngine.getOrderRow,
  readJournal: orderEngine.readJournal,
  OrderError: orderEngine.OrderError,

  placeCart: placement.placeCart,

  registerOrderSubscribers,
  orderJournal,
  ORDER_JOURNAL_TYPE,
  lifecycle,
};
