/**
 * Migration script — fusion conversations client_merchant durables.
 * La migration principale s'exécute au démarrage via backend/src/db/index.js.
 * Ce script peut être relancé manuellement : node backend/scripts/migrate-durable-merchant-conversations.js
 */
require('../src/db');
console.log('[Migration] Conversations durables — exécutée via db/index.js au boot.');
