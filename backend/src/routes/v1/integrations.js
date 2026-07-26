/**
 * API v1 — intégrations, en lecture.
 *
 * LOI 16, VUE DEPUIS LE CONTRAT PUBLIC. Ces routes parlent de « ce que cette boutique sait
 * faire » et de « ce que Ma Zone a refusé de la caisse ». Elles ne parlent jamais de
 * jeton, de format, de file d'attente ni de protocole : ces mots n'ont pas à apparaître
 * dans une URL publique, parce qu'ils n'ont pas à exister hors de l'Integration Engine.
 *
 * POURQUOI LES CAPACITÉS SONT PUBLIÉES. Une capacité (`push_sales`) dit qu'une boutique
 * sait pousser ses ventes, sans dire par quel logiciel. C'est ce qui permet à une surface
 * d'annoncer honnêtement à un commerçant « cette vente ne partira pas en caisse » AVANT
 * qu'il la fasse, au lieu de le découvrir en fin de mois (Loi 12). Une interface ne peut
 * dire la vérité que si l'API la lui donne.
 *
 * BRANCHER, DÉBRANCHER, IMPORTER RESTENT SUR `/api/integration`. Ce sont des gestes
 * d'administration d'une boutique, avec un écran dédié qui fonctionne, et aucun besoin
 * d'être versionnés pour un tiers. Publier une écriture sans avoir de consommateur, c'est
 * s'engager sur une forme qu'on n'a pas éprouvée.
 */

const express = require('express');
const { verifyToken, requireRole } = require('../../middleware/auth');
const access = require('../../lib/access');
const integration = require('../../lib/integration');

const router = express.Router();

/** Les connecteurs installés d'une boutique, indexés pour la fusion. */
function installedFor(storeId) {
  const map = new Map();
  for (const installation of integration.forStore(storeId, { activeOnly: false })) {
    map.set(installation.connector_id, installation);
  }
  return map;
}

// GET /api/v1/integrations?store_id=… — ce que Ma Zone sait brancher, et ce qui l'est
//
// `store_id` est optionnel : sans lui on répond le catalogue des connecteurs, ce qu'une
// page de présentation peut afficher sans authentifier une boutique. Avec lui, chaque
// connecteur porte son état de branchement — une seule requête pour l'écran complet.
router.get('/', verifyToken, (req, res) => {
  const storeId = req.query.store_id || null;

  if (storeId && !access.isStoreMember(req.user.id, storeId)) {
    return res.status(404).json({ error: 'Boutique introuvable' });
  }

  const installed = storeId ? installedFor(storeId) : new Map();

  const connectors = integration.connectors().map((connector) => {
    const installation = installed.get(connector.id) || null;
    return {
      id: connector.id,
      label: connector.label,
      capabilities: connector.capabilities,
      connected: !!installation && installation.status === integration.INSTALLATION_STATUS.ACTIVE,
      status: installation?.status ?? null,
    };
  });

  res.json({
    store_id: storeId,
    connectors,
    // Les capacités de la BOUTIQUE, pas celles d'un connecteur : c'est l'union de ce que
    // ses connecteurs actifs savent faire, et c'est la seule liste dont une interface a
    // besoin pour décider quoi promettre à l'utilisateur.
    capabilities: storeId ? integration.capabilitiesForStore(storeId) : [],
  });
});

// GET /api/v1/integrations/:connectorId/conflicts?store_id=… — ce que Ma Zone a refusé
//
// Un conflit tu devient une perte de confiance : le commerçant constate un stock qui ne
// correspond pas à sa caisse, sans savoir que Ma Zone a délibérément gardé sa valeur.
// Chaque entrée porte donc la valeur proposée, celle retenue, et la RAISON du refus.
router.get('/:connectorId/conflicts', verifyToken, requireRole('merchant'), (req, res) => {
  const storeId = req.query.store_id;
  if (!storeId) return res.status(400).json({ error: 'Paramètre store_id requis' });
  if (!access.isStoreMember(req.user.id, storeId)) {
    return res.status(404).json({ error: 'Boutique introuvable' });
  }

  const conflicts = integration
    .conflictsForStore(storeId, { connectorId: req.params.connectorId })
    .map((conflict) => ({
      id: conflict.id,
      connector_id: conflict.connector_id,
      entity_type: conflict.mazone_entity_type,
      mazone_id: conflict.mazone_id,
      attribute: conflict.attribute,
      proposed_value: conflict.proposed_value,
      retained_value: conflict.retained_value,
      reason: conflict.reason,
      acknowledged_at: conflict.acknowledged_at ?? null,
      created_at: conflict.created_at,
    }));

  res.json({ store_id: storeId, connector_id: req.params.connectorId, conflicts });
});

module.exports = router;
