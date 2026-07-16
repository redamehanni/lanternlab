/**
 * Outil de développement — Peuple le Wallet d'un client avec des objets de démo.
 *
 * Ce script simule ce que feront les vrais organes émetteurs (Event, Orders,
 * Marketing...) en appelant l'interface in-process du Wallet Engine.
 * Il n'est PAS utilisé en production et n'est monté sur aucune route.
 *
 * Usage :
 *   node scripts/seed-wallet-demo.js [email_client]
 * Sans argument, cible le premier utilisateur de rôle "client".
 */

const db = require('../src/db');
const wallet = require('../src/lib/walletEngine');

const emailArg = process.argv[2];

const client = emailArg
  ? db.prepare("SELECT * FROM users WHERE email = ? AND role = 'client'").get(emailArg)
  : db.prepare("SELECT * FROM users WHERE role = 'client' ORDER BY created_at ASC LIMIT 1").get();

if (!client) {
  console.error("Aucun client trouvé. Crée d'abord un compte client, ou passe un email en argument.");
  process.exit(1);
}

// Nettoie les objets de démo précédents pour rester idempotent.
const previous = db.prepare("SELECT id FROM digital_objects WHERE owner_id = ? AND source_engine = 'demo_seed'").all(client.id);
if (previous.length) {
  const delEvents = db.prepare('DELETE FROM digital_object_events WHERE object_id = ?');
  const delObj = db.prepare('DELETE FROM digital_objects WHERE id = ?');
  db.transaction(() => {
    for (const p of previous) {
      delEvents.run(p.id);
      delObj.run(p.id);
    }
  })();
}

const samples = [
  {
    kind: 'event_ticket',
    payload: { venue: 'Place centrale', date: '2026-08-15', seat: 'Zone A' },
    display: { title: 'Concert de quartier', subtitle: 'Place centrale · 15 août', primaryDate: '2026-08-15', category: 'culture' },
  },
  {
    kind: 'pickup_ticket',
    payload: { orderRef: 'CMD-1042' },
    display: { title: 'Épicerie du coin', subtitle: 'Commande CMD-1042 à retirer', category: 'commerce' },
  },
  {
    kind: 'promo_voucher',
    payload: { code: 'ZONE10' },
    display: { title: '-10% sur votre panier', subtitle: 'Code ZONE10', category: 'commerce' },
  },
  {
    kind: 'loyalty_card',
    payload: { points: 120 },
    display: { title: 'Boulangerie Lumière', subtitle: '120 points fidélité', category: 'commerce' },
  },
  {
    kind: 'badge',
    payload: { level: 2 },
    display: { title: 'Voisin actif', subtitle: 'Niveau 2', category: 'ville' },
  },
  {
    kind: 'civic_points',
    payload: { balance: 340 },
    display: { title: 'Points civiques', subtitle: 'Solde : 340', category: 'ville' },
  },
];

const created = [];
for (const s of samples) {
  const obj = wallet.issueObject({
    ownerId: client.id,
    kind: s.kind,
    payload: s.payload,
    display: s.display,
    sourceEngine: 'demo_seed',
    sourceRef: s.payload.orderRef || null,
  });
  created.push(obj);
}

// Transforme un billet en souvenir (démontre la consommation non destructive).
const ticket = created.find((o) => o.kind === 'event_ticket');
if (ticket) {
  wallet.consumeObject({ objectId: ticket.id, consumerEngine: 'demo_seed' });
}

console.log(`Wallet de ${client.name} (${client.email}) peuplé :`);
for (const o of created) {
  console.log(`  - [${o.family}] ${o.label} (${o.kind})`);
}
console.log("Un billet a été consommé pour illustrer la facette souvenir.");
console.log('Terminé.');
