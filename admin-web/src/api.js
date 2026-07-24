import { API_URL } from './config';

const TOKEN_KEY = 'mazone_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

async function req(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API_URL}/api/admin${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (email, password) => req('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => req('/me'),

  // World Factory
  recipes: () => req('/world/recipes'),
  run: (recipeId, params) => req('/world/run', { method: 'POST', body: { recipeId, params } }),
  batches: () => req('/world/batches'),
  reset: (batchId) => req('/world/reset', { method: 'POST', body: batchId ? { batchId } : {} }),

  // Explorateur
  actors: (query) => req(`/world/actors${query ? `?${query}` : ''}`),
  actor: (id) => req(`/world/actors/${id}`),

  // Laboratoire
  impersonate: (userId) => req('/impersonate', { method: 'POST', body: { userId } }),
  impersonateIos: (userId) => req('/impersonate-ios', { method: 'POST', body: { userId } }),
  labActions: () => req('/lab/actions'),
  runLabAction: (actionId, targetUserId, params) =>
    req(`/lab/actions/${actionId}`, { method: 'POST', body: { targetUserId, params } }),
};
