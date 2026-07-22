/**
 * Test d'intégration HTTP des routes Event Engine (production commerçant).
 *
 * Monte un serveur Express éphémère (auth + events), enregistre un commerçant,
 * lui attache une boutique, puis exerce le cycle création → publication →
 * découverte via HTTP réel. Nettoie tout ce qu'il a créé.
 */

const express = require('express');
const db = require('../src/db');
const authRoutes = require('../src/routes/auth');
const eventsRoutes = require('../src/routes/events');

const app = express();
app.use(express.json());
app.set('io', null);
app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; console.log(`  ✓ ${l}`); } else { failed++; console.error(`  ✗ ${l}`); } };

const stamp = Date.now().toString(36);
const email = `test.merchant.${stamp}@mazone.test`;
let server, base, token, userId, storeId, eventId;

async function post(path, body, tok) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function get(path, tok) {
  const res = await fetch(`${base}${path}`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function cleanup() {
  try {
    if (eventId) {
      db.prepare('DELETE FROM event_journal WHERE event_id = ?').run(eventId);
      db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    }
    if (storeId) {
      db.prepare('DELETE FROM store_members WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
    }
    if (userId) db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  } catch (e) { console.error('cleanup', e.message); }
}

(async () => {
  await new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); });
  try {
    console.log('\n── Inscription commerçant + boutique ──');
    const reg = await post('/api/auth/register', { name: 'Test Merchant', email, password: 'demo1234', role: 'merchant' });
    ok(reg.status === 201, 'commerçant enregistré');
    token = reg.data.token; userId = reg.data.user.id;

    storeId = db.generateId();
    db.prepare(`INSERT INTO stores (id, merchant_id, name, address) VALUES (?, ?, ?, ?)`).run(storeId, userId, 'Boutique Test', '1 rue test');
    db.prepare(`INSERT OR IGNORE INTO store_members (store_id, user_id, member_role) VALUES (?, ?, 'owner')`).run(storeId, userId);
    ok(true, 'boutique rattachée');

    console.log('\n── Métadonnées ──');
    const types = await get('/api/events/types', token);
    ok(types.status === 200 && types.data.types.length >= 3, 'GET /types renvoie les types');
    const channels = await get('/api/events/channels', token);
    ok(channels.status === 200 && channels.data.channels.length > 0, 'GET /channels renvoie les canaux');

    console.log('\n── Création (production) ──');
    const create = await post('/api/events', {
      type: 'degustation',
      title: 'Dégustation de printemps',
      summary: 'Fromages fermiers et cidre local',
      startsAt: '2026-09-10 18:00',
      address: '1 rue test',
      channels: ['gastronomie', 'commerces'],
    }, token);
    ok(create.status === 201, 'POST /events crée l\'initiative');
    eventId = create.data.event?.id;
    ok(create.data.event?.status === 'draft', 'naît en brouillon');
    ok(create.data.event?.sourceKind === 'merchant', 'source = merchant');
    ok(create.data.event?.storeId === storeId, 'rattachée à la boutique');

    console.log('\n── Mine / Publication / Découverte ──');
    const mine = await get('/api/events/mine', token);
    ok(mine.status === 200 && mine.data.events.some((e) => e.id === eventId), 'GET /mine liste l\'initiative');

    const beforePublic = await get('/api/events', token);
    ok(!beforePublic.data.events.some((e) => e.id === eventId), 'brouillon absent de la découverte publique');

    const publish = await post(`/api/events/${eventId}/publish`, {}, token);
    ok(publish.status === 200 && publish.data.event.status === 'published', 'POST /publish publie');

    const afterPublic = await get('/api/events?channel=gastronomie', token);
    ok(afterPublic.data.events.some((e) => e.id === eventId), 'publiée visible dans la découverte (canal gastronomie)');

    const journal = await get(`/api/events/${eventId}/journal`, token);
    ok(journal.data.journal.length >= 2 && journal.data.journal.some((j) => j.type === 'published'), 'journal expose created + published');

    console.log('\n── Garde d\'appartenance ──');
    const intruder = await post('/api/auth/register', { name: 'Autre', email: `intru.${stamp}@mazone.test`, password: 'demo1234', role: 'merchant' });
    const cancel = await post(`/api/events/${eventId}/cancel`, {}, intruder.data.token);
    ok(cancel.status === 403, 'un autre commerçant ne peut pas annuler l\'initiative');
    db.prepare('DELETE FROM users WHERE id = ?').run(intruder.data.user.id);

    console.log(`\n${passed} réussis, ${failed} échoués\n`);
  } catch (e) {
    console.error('Erreur fatale :', e);
    failed++;
  } finally {
    cleanup();
    server.close();
    process.exit(failed === 0 ? 0 : 1);
  }
})();
