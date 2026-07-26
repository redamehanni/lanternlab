/**
 * API v1 — inventaire, vu par la boutique qui le possède.
 *
 * La contrepartie exacte de `catalog.js` : ici on expose les quatre valeurs, et l'accès
 * est vérifié à chaque requête. C'est la seule surface publique qui montre `on_hand`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `PATCH` DÉCLARE DU PHYSIQUE, ET C'EST UNE PROMESSE TENUE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `lib/inventory/inventoryEngine.js` porte, depuis l'étape 4, ce commentaire à propos de
 * `declareSellable` : « cette traduction disparaît à l'étape 7 : l'API v1 exposera
 * `on_hand` explicitement aux surfaces commerçant, et le formulaire déclarera du
 * physique. » C'est cette route.
 *
 * Le problème qu'elle résout mérite d'être rappelé, parce qu'il est contre-intuitif. Les
 * écrans actuels affichent `products.quantity`, devenu la projection du VENDABLE. Quand
 * le commerçant réenregistre ce nombre sans y toucher, l'interpréter comme du physique
 * ferait fondre son stock à chaque enregistrement :
 *
 *     on_hand 12, reserved 2 → affiché 10 → réenregistré → on_hand 10 → affiché 8
 *
 * L'ancienne API compense en recalculant `on_hand = vendable + reserved + safety_buffer`.
 * Cette compensation est juste, mais elle repose sur une DEVINETTE : « ce nombre est
 * sûrement du vendable ». Ici, plus de devinette — le champ s'appelle `on_hand`, il
 * signifie le physique, et le vendable est calculé. C'est ce que gagne une API versionnée :
 * le droit de nommer les choses correctement.
 *
 * `PATCH` ET NON `POST /intents` : mettre à jour un stock ne concerne qu'un organe, et le
 * registre d'intentions refuse d'ailleurs de déclarer une intention mono-organe (Loi 5).
 * Faire passer ce geste par l'orchestration en ferait un passage obligé, donc un goulot,
 * puis un god object. Une route mono-organe parle à son organe, directement.
 *
 * DÉCLARATIF, DONC REJOUABLE. Le corps porte des valeurs CIBLES, jamais des deltas.
 * Envoyer deux fois `{ "on_hand": 12 }` laisse le stock à 12 ; envoyer deux fois
 * `{ "delta": +5 }` en ajoute dix. C'est pourquoi `Idempotency-Key` n'est pas exigée ici :
 * la forme du corps rend le rejeu sans danger. Une API n'a pas à demander une précaution
 * qu'elle peut s'offrir par construction.
 */

const express = require('express');
const db = require('../../db');
const { verifyToken, requireRole } = require('../../middleware/auth');
const access = require('../../lib/access');
const inventory = require('../../lib/inventory');
const projections = require('./projections');

const router = express.Router();

/**
 * L'appelant fait-il partie de la boutique de ce produit ?
 *
 * 404 et non 403 : répondre « interdit » confirmerait qu'un produit existe sous cet
 * identifiant, ce qui suffit à cartographier le catalogue d'un concurrent.
 */
function requireProductOwnership(req, res, next) {
  const row = db
    .prepare('SELECT id, store_id FROM products WHERE id = ?')
    .get(req.params.productId);

  if (!row || !access.isStoreMember(req.user.id, row.store_id)) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }

  req.product = row;
  return next();
}

function fail(res, err) {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  throw err;
}

// GET /api/v1/inventory?store_id=… — l'inventaire d'une boutique
//
// `store_id` en paramètre de requête plutôt qu'une route `/stores/:id/inventory` : la
// ressource listée est un inventaire, pas une boutique. Le filtre est un filtre.
router.get('/', verifyToken, requireRole('merchant'), (req, res) => {
  const storeId = req.query.store_id;
  if (!storeId) return res.status(400).json({ error: 'Paramètre store_id requis' });
  if (!access.isStoreMember(req.user.id, storeId)) {
    return res.status(404).json({ error: 'Boutique introuvable' });
  }

  const levels = inventory.listForStore(storeId).map((level) => ({
    ...projections.stockForStore(level),
    product_name: level.product_name ?? null,
  }));

  res.json({ store_id: storeId, levels });
});

// GET /api/v1/inventory/:productId — les quatre valeurs
router.get('/:productId', verifyToken, requireRole('merchant'), requireProductOwnership, (req, res) => {
  const level = inventory.getLevel(req.params.productId);

  // Aucune ligne de stock : le produit n'a jamais été touché par l'organe. On ne la crée
  // pas pour une lecture — un GET qui écrit est une surprise qu'on finit toujours par
  // payer — mais on répond une vérité utilisable plutôt qu'un 404 trompeur.
  if (!level) {
    return res.json({
      stock: {
        product_id: req.params.productId,
        variant_id: null,
        on_hand: inventory.getSellableQty(req.params.productId),
        reserved: 0,
        safety_buffer: 0,
        available: inventory.getSellableQty(req.params.productId),
        inventory_owner: inventory.INVENTORY_OWNER.MAZONE,
        updated_at: null,
      },
      adopted: false,
    });
  }

  res.json({ stock: projections.stockForStore(level), adopted: true });
});

// GET /api/v1/inventory/:productId/movements — pourquoi mon stock a bougé
router.get(
  '/:productId/movements',
  verifyToken, requireRole('merchant'), requireProductOwnership,
  (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const movements = inventory
      .readMovements(req.params.productId, { limit })
      .map(projections.movementForStore);

    res.json({ product_id: req.params.productId, movements });
  }
);

// PATCH /api/v1/inventory/:productId — déclarer le stock physique
router.patch('/:productId', verifyToken, requireRole('merchant'), requireProductOwnership, (req, res) => {
  const { on_hand: onHand, safety_buffer: safetyBuffer, reason = null } = req.body || {};

  if (onHand === undefined && safetyBuffer === undefined) {
    return res.status(400).json({
      error: 'Rien à déclarer : fournissez on_hand et/ou safety_buffer.',
    });
  }

  // Refus AVANT toute écriture. Les deux champs sont appliqués par deux opérations
  // distinctes de l'organe — deux mouvements au journal, ce qui est la vérité : ce sont
  // deux décisions. Sans ce contrôle préalable, une déclaration mixte sur un produit en
  // mode `pos` écrirait le tampon puis se ferait refuser le physique, et laisserait le
  // commerçant devant une modification à moitié faite.
  if (onHand !== undefined) {
    const level = inventory.getLevel(req.params.productId);
    if (level && level.inventory_owner === inventory.INVENTORY_OWNER.POS) {
      return res.status(409).json({
        error: 'Le stock physique de ce produit est un miroir de la caisse : '
          + 'il se corrige dans la caisse, pas dans Ma Zone.',
        inventory_owner: level.inventory_owner,
      });
    }
  }

  try {
    if (safetyBuffer !== undefined) {
      inventory.setSafetyBuffer(req.params.productId, safetyBuffer);
    }

    const level = onHand === undefined
      ? inventory.getLevel(req.params.productId)
      : inventory.syncOnHand({
        productId: req.params.productId,
        onHand,
        origin: inventory.MOVEMENT_ORIGIN.MERCHANT,
        actor: req.user.id,
        reason: reason || 'déclaré depuis l\'API v1',
      });

    res.json({ stock: projections.stockForStore(level) });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
