import axios from 'axios';
import { appStorage } from '../utils/storage';
import { API_URL } from '../config';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await appStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (data) => api.post('/api/auth/register', data);
export const login    = (data) => api.post('/api/auth/login', data);

// ── Utilisateur / profil ───────────────────────────────────────────────────────
export const getMe         = () => api.get('/api/users/me');
export const updateProfile = (formData) => api.put('/api/users/me', formData, MULTIPART);
export const getAddresses  = () => api.get('/api/users/addresses');
export const addAddress    = (data) => api.post('/api/users/addresses', data);
export const deleteAddress = (id) => api.delete(`/api/users/addresses/${id}`);

// ── Boutiques ─────────────────────────────────────────────────────────────────
export const getMyStore   = () => api.get('/api/stores/mine');
export const getStores    = () => api.get('/api/stores');
export const getStoreById = (id) => api.get(`/api/stores/${id}`);
export const createStore  = (formData) => api.post('/api/stores', formData, MULTIPART);
export const updateStore  = (id, formData) => api.put(`/api/stores/${id}`, formData, MULTIPART);

// ── Produits ──────────────────────────────────────────────────────────────────
export const searchProducts   = (q) => api.get(`/api/products/search?q=${encodeURIComponent(q)}`);
export const getStoreProducts = (storeId) => api.get(`/api/products?storeId=${storeId}`);
export const getProductById   = (id) => api.get(`/api/products/${id}`);

export const createProduct = (formData) =>
  api.post('/api/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const updateProductStock = (id, delta) =>
  api.patch(`/api/products/${id}/stock`, { delta });

export const setProductStock = (id, quantity) =>
  api.patch(`/api/products/${id}/stock`, { quantity });

export const updateProduct = (id, formData) =>
  api.put(`/api/products/${id}`, formData, MULTIPART);

export const deleteProduct = (id) => api.delete(`/api/products/${id}`);

// ── Panier ────────────────────────────────────────────────────────────────────
export const getCart = () => api.get('/api/cart');
export const addToCart = (product_id, quantity = 1) => api.post('/api/cart', { product_id, quantity });
export const updateCartItem = (id, quantity) => api.patch(`/api/cart/${id}`, { quantity });
export const removeCartItem = (id) => api.delete(`/api/cart/${id}`);
export const clearCart = () => api.delete('/api/cart');
export const checkoutCart = (data) => api.post('/api/orders/cart', data);

// ── Favoris ───────────────────────────────────────────────────────────────────
export const getFavoriteStores = () => api.get('/api/favorites');
export const getFavoriteIds = () => api.get('/api/favorites/ids');
export const toggleFavoriteStore = (store_id) => api.post('/api/favorites/toggle', { store_id });

// ── Promotions ────────────────────────────────────────────────────────────────
export const getFlashPromotions = () => api.get('/api/promotions/flash');
export const getMyPromotions = () => api.get('/api/promotions/mine');
export const createPromotion = (data) => api.post('/api/promotions', data);
export const updatePromotion = (id, data) => api.patch(`/api/promotions/${id}`, data);
export const deletePromotion = (id) => api.delete(`/api/promotions/${id}`);

// ── Commandes ─────────────────────────────────────────────────────────────────
export const createOrder       = (data) => api.post('/api/orders', data);
export const cancelOrder       = (id) => api.post(`/api/orders/${id}/cancel`);
export const getMyOrders       = () => api.get('/api/orders/mine');
export const getMerchantOrders = () => api.get('/api/orders/merchant');
export const getOrderById      = (id) => api.get(`/api/orders/${id}`);

// ── Livreur ───────────────────────────────────────────────────────────────────
export const getDriverBroadcast = () => api.get('/api/drivers/broadcast');
export const getDriverOnline = () => api.get('/api/drivers/online');
export const setDriverOnline = (online) => api.put('/api/drivers/online', { online });
export const getDriverNotifications = () => api.get('/api/drivers/notifications');
export const resolveDriverSupport = () => api.post('/api/drivers/support/resolve');
export const getSupportMessages = (threadId) => api.get(`/api/drivers/support/${threadId}/messages`);
export const sendSupportMessage = (threadId, content) => api.post(`/api/drivers/support/${threadId}/messages`, { content });

// ── Commerçant ────────────────────────────────────────────────────────────────
export const resolveMerchantSupport = () => api.post('/api/merchants/support/resolve');
export const getMerchantNotifications = () => api.get('/api/merchants/notifications');
export const getMerchantSupportMessages = (threadId) => api.get(`/api/merchants/support/${threadId}/messages`);
export const sendMerchantSupportMessage = (threadId, content) => api.post(`/api/merchants/support/${threadId}/messages`, { content });

export const getAvailableMissions = () => api.get('/api/missions/available');
export const getMyMissions        = () => api.get('/api/missions/mine');
export const getDriverStats       = () => api.get('/api/missions/stats');
export const acceptMission        = (id) => api.post(`/api/missions/${id}/accept`);
export const acceptMissionOffer   = (id) => api.post(`/api/missions/${id}/accept-offer`);
export const declineMissionOffer  = (id) => api.post(`/api/missions/${id}/decline-offer`);
export const getOfferedMission    = () => api.get('/api/missions/offered');
export const refuseMission        = (id) => api.post(`/api/missions/${id}/refuse`);
export const updateMissionStatus  = (id, status) => api.patch(`/api/missions/${id}/status`, { status });

// ── Communication (organe unifié) ─────────────────────────────────────────────
export const getCommunicationThreads = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return api.get(`/api/communication/threads${q ? `?${q}` : ''}`);
};
export const resolveCommunicationThread = (data) =>
  api.post('/api/communication/resolve', data);
export const getCommunicationMessages = (id) =>
  api.get(`/api/communication/threads/${id}/messages`);
export const sendCommunicationMessage = (id, content, context_order_id) =>
  api.post(`/api/communication/threads/${id}/messages`, { content, context_order_id });
export const markCommunicationRead = (id) =>
  api.post(`/api/communication/threads/${id}/read`);

// ── Wallet (registre des objets numériques) ───────────────────────────────────
export const getWallet = () => api.get('/api/wallet');
export const getWalletFamilies = () => api.get('/api/wallet/families');
export const getWalletObjects = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return api.get(`/api/wallet/objects${q ? `?${q}` : ''}`);
};
export const getWalletObject = (id) => api.get(`/api/wallet/objects/${id}`);
export const getWalletObjectCapabilities = (id) => api.get(`/api/wallet/objects/${id}/capabilities`);
export const getWalletObjectEvents = (id) => api.get(`/api/wallet/objects/${id}/events`);

// ── Event Engine (initiatives locales) ────────────────────────────────────────
// Production : le commerçant crée, édite, publie ses initiatives via l'Épée.
// Découverte : projections publiques (consommées plus tard par la Deuxième Âme).
export const getEventTypes    = () => api.get('/api/events/types');
export const getEventChannels = () => api.get('/api/events/channels');
export const getMyEvents      = () => api.get('/api/events/mine');
export const createEvent      = (data) => api.post('/api/events', data);
export const updateEvent      = (id, data) => api.patch(`/api/events/${id}`, data);
export const publishEvent     = (id) => api.post(`/api/events/${id}/publish`);
export const cancelEvent      = (id) => api.post(`/api/events/${id}/cancel`);
export const getEventById     = (id) => api.get(`/api/events/${id}`);
export const getEventJournal  = (id) => api.get(`/api/events/${id}/journal`);
// Mode Réception (l'habitant construit ses canaux d'écoute).
export const getModeReception = () => api.get('/api/events/reception');
export const setModeReception = (subscriptions) => api.put('/api/events/reception', { subscriptions });
// Opportunité Volante (le producteur diffuse activement son initiative).
export const diffuseEvent     = (id, policy = {}) => api.post(`/api/events/${id}/diffuse`, policy);
export const getEventDiffusions = (id) => api.get(`/api/events/${id}/diffusions`);
// Boîte aux lettres (reçus d'Opportunités Volantes).
export const getOpportunityInbox = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return api.get(`/api/events/inbox${q ? `?${q}` : ''}`);
};
export const acceptOpportunity = (inboxId) => api.post(`/api/events/inbox/${inboxId}/accept`);
export const dismissOpportunity = (inboxId) => api.post(`/api/events/inbox/${inboxId}/dismiss`);
export const getPublicEvents  = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return api.get(`/api/events${q ? `?${q}` : ''}`);
};
// Découverte / portes de la Deuxième Âme (préparation).
export const getEventDiscovery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return api.get(`/api/events/feed/discover${q ? `?${q}` : ''}`);
};
export const getEventMurmurs   = () => api.get('/api/events/feed/murmurs');
// Orchestration côté habitant (billet Wallet, découverte Lanterne).
export const requestEventTicket = (id) => api.post(`/api/events/${id}/ticket`);
export const discoverLantern    = (id) => api.post(`/api/events/${id}/discover`);

// ── Identity (preuve d'identité présentable) ──────────────────────────────────
// Le QR n'est qu'un canal : le backend renvoie un handle neutre à présenter.
export const getIdentityToken = () => api.get('/api/identity/token');
export const verifyIdentity = (data) => api.post('/api/identity/verify', data);
export const getIdentityHistory = () => api.get('/api/identity/history');

// ── Conversations (legacy alias) ───────────────────────────────────────────────
export const getConversations     = () => api.get('/api/conversations');
export const resolveConversation  = (order_id, target_role) =>
  api.post('/api/conversations/resolve', { order_id, target_role });
export const getConversationMessages = (id) => api.get(`/api/conversations/${id}/messages`);
export const sendConversationMessage = (id, content) =>
  api.post(`/api/conversations/${id}/messages`, { content });
