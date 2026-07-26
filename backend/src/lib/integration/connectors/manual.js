/**
 * Connecteur « manual » — le commerçant sans logiciel, ou avec un logiciel sans API.
 *
 * PREMIER CONNECTEUR, ET CHOISI EXPRÈS. Valider le contrat sur un éditeur réel
 * obligerait à déboguer simultanément notre architecture et une API que nous ne
 * contrôlons pas. Ici, le « logiciel tiers » est un fichier et un formulaire : si quelque
 * chose ne marche pas, la faute est chez nous, et c'est exactement ce qu'on veut prouver.
 *
 * Ce n'est pas pour autant un connecteur jouet. C'est le cas d'usage MAJORITAIRE des
 * commerçants que Ma Zone adresse d'abord : ils tiennent leur stock sur un cahier ou un
 * tableur. Le chemin d'adoption A de la roadmap, c'est celui-là.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE CONNECTEUR NE FAIT PAS — LOI 2
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Il ne crée aucun produit, ne modifie aucun stock, n'écrit dans aucune table. Il
 * TRADUIT un CSV en vocabulaire Ma Zone, et rend la main. Ce sont des organes qui
 * décident ensuite, par une intention orchestrée.
 *
 * La tentation était forte de faire autrement : un `INSERT INTO products` dans la boucle
 * d'import aurait fait gagner une journée. Il aurait aussi fait de ce fichier le
 * deuxième endroit du système qui sait créer un produit — et le jour où la règle de
 * création change, personne ne penserait à venir la changer dans un connecteur.
 */

const registry = require('../connectorRegistry');
const csv = require('./csv');

/** Colonnes acceptées, avec leurs synonymes courants. Aucune n'est sensible à la casse. */
const COLUMNS = {
  reference: ['reference', 'ref', 'sku', 'code', 'code_barre', 'barcode', 'ean', 'gencod'],
  name: ['name', 'nom', 'libelle', 'designation', 'produit', 'article'],
  price: ['price', 'prix', 'prix_ttc', 'prix_vente', 'tarif'],
  quantity: ['quantity', 'quantite', 'qte', 'stock', 'qty', 'quantite_en_stock'],
  category: ['category', 'categorie', 'rayon', 'famille'],
  description: ['description', 'descriptif', 'detail'],
};

/** Première colonne présente dans la ligne pour un rôle donné. */
function pick(row, role) {
  for (const candidate of COLUMNS[role]) {
    if (row[candidate] !== undefined && String(row[candidate]).trim() !== '') {
      return String(row[candidate]).trim();
    }
  }
  return null;
}

/** Le fichier a-t-il les colonnes minimales ? Répondu AVANT de traiter 500 lignes. */
function inspect(document) {
  const { headers, rows } = csv.parse(document);
  const missing = [];

  const hasAny = (role) => COLUMNS[role].some((c) => headers.includes(c));
  if (!hasAny('reference')) missing.push('une référence (référence, code-barres ou SKU)');
  if (!hasAny('name')) missing.push('un nom de produit');
  if (!hasAny('quantity')) missing.push('une quantité en stock');

  return { headers, lineCount: rows.length, missing, usable: missing.length === 0 };
}

/**
 * Traduit un document en déclarations canoniques.
 *
 * `pull` sans document renvoie une liste vide, et ce n'est pas un contournement : un
 * connecteur manuel n'a rien à aller chercher tant qu'un commerçant ne lui a rien donné.
 * Un worker qui l'interrogerait périodiquement obtiendrait honnêtement « rien de neuf ».
 */
function pull(resource, cursor, ctx = {}) {
  if (resource !== 'product' && resource !== 'inventory') {
    return { items: [], nextCursor: null };
  }
  if (!ctx.document) return { items: [], nextCursor: null };

  const { rows } = csv.parse(ctx.document);
  const items = [];
  const rejected = [];

  for (const row of rows) {
    const reference = pick(row, 'reference');
    const name = pick(row, 'name');
    const quantity = csv.toInt(pick(row, 'quantity'));

    if (!reference) {
      rejected.push({ line: row.__line, reason: 'référence manquante' });
      continue;
    }
    if (!name) {
      rejected.push({ line: row.__line, reason: 'nom manquant' });
      continue;
    }
    // Cellule vide REFUSÉE plutôt qu'interprétée. Entre « je n'ai plus rien » et « je ne
    // déclare rien pour ce produit », le fichier ne tranche pas — et deviner ferait
    // disparaître un stock que le commerçant croyait intact.
    if (quantity === null) {
      rejected.push({ line: row.__line, reason: 'quantité vide ou illisible' });
      continue;
    }
    if (quantity < 0) {
      rejected.push({ line: row.__line, reason: 'quantité négative' });
      continue;
    }

    items.push({
      externalId: reference,
      reference,
      name,
      price: parsePrice(pick(row, 'price')),
      quantity,
      category: pick(row, 'category'),
      description: pick(row, 'description'),
      line: row.__line,
    });
  }

  return { items, rejected, nextCursor: null };
}

/** Prix tolérant : « 12,50 € » est ce qu'un tableur français produit. */
function parsePrice(value) {
  if (value === null) return null;
  const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Traduction entrante vers le CDM.
 *
 * Le connecteur manuel a la traduction la plus simple possible — son « dialecte » est
 * déjà proche du nôtre. Le contrat l'exige quand même : c'est ce qui garantit que le
 * moteur n'a jamais à savoir de quel connecteur vient un message.
 */
function toCanonical(resource, external) {
  if (resource === 'inventory') {
    return {
      externalId: external.externalId ?? external.reference,
      onHand: external.quantity,
      sourceUpdatedAt: external.sourceUpdatedAt ?? null,
    };
  }

  return {
    externalId: external.externalId ?? external.reference,
    reference: external.reference,
    name: external.name,
    price: external.price,
    quantity: external.quantity,
    category: external.category ?? null,
    description: external.description ?? null,
    sourceUpdatedAt: external.sourceUpdatedAt ?? null,
  };
}

/**
 * Traduction sortante.
 *
 * Le « dialecte » de sortie du connecteur manuel est une ligne de tableur, parce que sa
 * destination est un humain qui recopiera dans sa caisse.
 */
function fromCanonical(resource, canonical) {
  if (resource !== 'order') return canonical;

  return {
    date: canonical.createdAt ?? null,
    commande: canonical.orderId ?? null,
    produit: canonical.productName ?? null,
    reference: canonical.reference ?? null,
    quantite: canonical.quantity ?? null,
    montant: canonical.totalPrice ?? null,
    operation: canonical.operation ?? 'vente',
  };
}

/**
 * « Envoi » d'une vente.
 *
 * Aucun réseau, et pourtant ce n'est pas un faux : la destination du connecteur manuel
 * est la file elle-même. Un message marqué envoyé devient une ligne de l'export que le
 * commerçant télécharge pour recopier dans sa caisse. L'Outbox est le registre d'export.
 *
 * Le retour est explicitement sans référence externe : un tableur n'attribue pas
 * d'identifiant, et prétendre le contraire créerait une correspondance imaginaire.
 */
function push(resource, external, ctx) {
  return { externalRef: null, delivered: 'export', resource, operation: ctx.operation };
}

const connector = registry.register({
  id: 'manual',
  label: 'Saisie et fichiers (aucun logiciel à connecter)',
  requiresAuth: false,
  capabilities: ['pull_catalog', 'pull_inventory', 'push_sales'],
  resources: ['product', 'inventory', 'order'],
  pull,
  push,
  toCanonical,
  fromCanonical,
});

// `inspect` est hors contrat, et le reste : vérifier un fichier avant de l'importer est
// propre à ce connecteur. Le registre ne retient que les méthodes du contrat, ce qui
// garantit qu'aucun moteur ne peut se mettre à dépendre d'une extension maison.
module.exports = { ...connector, inspect, COLUMNS };
