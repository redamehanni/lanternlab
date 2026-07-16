/**
 * Actions de labo — Organe Wallet.
 *
 * Ces actions n'implémentent AUCUNE logique métier : elles délèguent au Wallet
 * Engine (`issueObject`, `consumeObject`). C'est exactement le chemin qu'un
 * futur organe émetteur (Event, Marketing…) empruntera en production.
 */

const { defineAction } = require('../actionRegistry');
const wallet = require('../../walletEngine');

// Types d'objets disponibles pour le formulaire du labo (issus du registre Wallet).
const kindOptions = wallet
  .listKinds()
  .map((k) => ({ value: k.kind, label: k.label }));

defineAction({
  id: 'issue_wallet_object',
  label: 'Émettre un objet Wallet',
  description: "Demande au Wallet Engine d'émettre un objet numérique dans le Wallet de l'acteur.",
  organ: 'wallet',
  params: {
    kind: { type: 'enum', label: "Type d'objet", options: kindOptions, required: true },
    title: { type: 'text', label: 'Titre affiché', required: true },
    subtitle: { type: 'text', label: 'Sous-titre', required: false },
    category: { type: 'text', label: 'Catégorie (affichage)', required: false },
  },
  run({ targetUserId, params = {}, io }) {
    return wallet.issueObject(
      {
        ownerId: targetUserId,
        kind: params.kind,
        payload: params.payload || null,
        display: {
          title: params.title,
          subtitle: params.subtitle || null,
          category: params.category || null,
        },
        sourceEngine: 'lab',
      },
      io
    );
  },
});

defineAction({
  id: 'consume_wallet_object',
  label: 'Consommer un objet Wallet',
  description: "Demande au Wallet Engine de consommer un objet (usage du droit, facette souvenir).",
  organ: 'wallet',
  params: {
    objectId: { type: 'text', label: "Identifiant de l'objet", required: true },
  },
  run({ params = {}, io }) {
    return wallet.consumeObject(
      { objectId: params.objectId, consumerEngine: 'lab' },
      io
    );
  },
});
