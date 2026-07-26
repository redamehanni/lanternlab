/**
 * Connecteur Shopify — la traduction, dans les deux sens.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA DÉCISION LA PLUS IMPORTANTE DE TOUT LE CONNECTEUR TIENT EN UNE LIGNE :
 * L'IDENTITÉ EXTERNE D'UN PRODUIT EST SON `inventory_item_id`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Shopify nomme la même marchandise de trois façons selon le flux :
 *
 *   · `product.id`         la fiche commerciale, qui peut porter dix déclinaisons ;
 *   · `variant.id`         la déclinaison, c'est-à-dire ce qui se vend réellement ;
 *   · `inventory_item_id`  la chose dont on compte les unités.
 *
 * Le catalogue parle de variantes. Les notifications de stock — `inventory_levels/update`,
 * la seule qui compte pour Ma Zone — parlent d'`inventory_item_id` et ignorent la variante.
 *
 * Choisir `variant.id` comme identité aurait donc produit le bug le plus coûteux possible :
 * un catalogue importé correctement, puis CHAQUE notification de stock refusée en
 * `unmapped_entity`, parce que l'identifiant reçu n'existe dans aucune correspondance. Le
 * commerçant verrait un journal de conflits qui se remplit, un stock qui ne bouge pas, et
 * aucune erreur nulle part. Rien dans le moteur ne permettrait de le deviner : c'est au
 * connecteur de choisir l'identifiant qui apparaît dans TOUS ses flux.
 *
 * `inventory_item_id` est cet identifiant. La déclinaison reste visible dans le nom du
 * produit Ma Zone, où elle a du sens pour un humain.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'ÉTABLISSEMENT EST PORTÉ PAR `externalLocationId`, PAS FONDU DANS L'IDENTIFIANT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un même article a un stock par établissement chez Shopify. La table `external_bindings`
 * prévoit `external_location_id` depuis l'étape 6, pour exactement ce cas : sans elle, deux
 * magasins d'un même commerçant écraseraient mutuellement leur stock. Fabriquer une clé
 * composite `item:location` aurait marché aussi, et aurait rendu impossible de retrouver un
 * article indépendamment de son magasin.
 */

/** Une variante sans référence propre reste identifiable : sinon le Catalog la refuse. */
function referenceOf(variant) {
  const sku = String(variant.sku || '').trim();
  if (sku) return sku;

  const barcode = String(variant.barcode || '').trim();
  if (barcode) return barcode;

  // Dernier recours EXPLICITE plutôt que rejet. Une boutique Shopify sans SKU est courante
  // — c'est même le cas par défaut — et refuser l'article priverait le commerçant de son
  // catalogue pour une convention de saisie qui ne le concerne pas. Le préfixe dit d'où
  // vient la référence, pour que personne ne la prenne pour un code-barres réel.
  return `shopify-${variant.inventory_item_id || variant.id}`;
}

/**
 * Nom lisible : « Pull en laine — Rouge / M ».
 *
 * Shopify appelle « Default Title » la variante unique d'un produit sans déclinaison. La
 * recopier donnerait des noms absurdes dans l'Épée du commerçant.
 */
function nameOf(product, variant) {
  const title = String(product.title || '').trim();
  const suffix = String(variant.title || '').trim();
  if (!suffix || suffix.toLowerCase() === 'default title') return title;
  return `${title} — ${suffix}`;
}

/**
 * Une fiche Shopify devient N déclarations Ma Zone, une par variante.
 *
 * Ma Zone n'a pas de notion de déclinaison au catalogue : ses produits sont plats. Aplatir
 * ici est donc la traduction juste — et c'est aussi une dette nommée, à reprendre le jour où
 * le CDM portera des variantes.
 */
function flattenProduct(product) {
  const variants = product.variants || [];

  return variants
    // Une variante non suivie en stock chez Shopify n'a pas d'`inventory_item_id`
    // exploitable : l'importer créerait un produit dont le stock ne se synchroniserait
    // jamais, ce qui est pire que son absence.
    .filter((variant) => !!variant.inventory_item_id)
    .map((variant) => ({
      externalId: String(variant.inventory_item_id),
      variantId: String(variant.id),
      productId: String(product.id),
      reference: referenceOf(variant),
      name: nameOf(product, variant),
      price: parsePrice(variant.price),
      category: product.product_type || null,
      description: stripHtml(product.body_html),
      sourceUpdatedAt: variant.updated_at || product.updated_at || null,
    }));
}

/** Prix Shopify : une chaîne décimale (« 24.90 »), jamais un nombre. */
function parsePrice(value) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Description : le HTML de Shopify n'a rien à faire dans une application mobile.
 *
 * Un `<script>` recopié tel quel dans une fiche produit serait au mieux du bruit, au pire
 * une charge injectée par une boutique compromise. On garde le texte.
 */
function stripHtml(html) {
  if (!html) return null;
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/**
 * Traduction entrante vers le vocabulaire Ma Zone.
 *
 * Le moteur appelle cette fonction sans jamais savoir de quel éditeur vient l'élément. Elle
 * doit donc rendre des noms canoniques et RIEN qui ressemble à du Shopify.
 */
function toCanonical(resource, external) {
  if (resource === 'inventory') {
    return {
      externalId: String(external.inventory_item_id ?? external.externalId ?? ''),
      externalLocationId: external.location_id ? String(external.location_id) : null,
      // `available` chez Shopify est le stock PHYSIQUE disponible en magasin. Il devient
      // `onHand` chez nous, jamais `available` : notre `available` est calculé et retire les
      // réservations Ma Zone, que Shopify ne connaît pas (Loi 11).
      onHand: Number.isFinite(external.available) ? external.available : 0,
      sourceUpdatedAt: external.updated_at || null,
    };
  }

  // Un produit peut arriver déjà aplati (lecture de catalogue) ou brut (notification).
  const item = external.variants ? flattenProduct(external)[0] : external;
  if (!item) return { externalId: null, reference: null, name: null };

  return {
    externalId: item.externalId,
    reference: item.reference,
    name: item.name,
    price: item.price ?? null,
    // Le stock N'EST PAS déclaré par le catalogue, et c'est volontaire : chez Shopify il
    // appartient aux niveaux d'inventaire, qui arrivent par leur propre chemin avec leur
    // établissement et leur horodatage. Le déduire ici créerait une deuxième source de
    // vérité pour la même valeur.
    quantity: 0,
    category: item.category ?? null,
    description: item.description ?? null,
    externalLocationId: item.externalLocationId ?? null,
    sourceUpdatedAt: item.sourceUpdatedAt ?? null,
  };
}

/**
 * Traduction sortante.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNE VENTE MA ZONE N'EST PAS UNE COMMANDE SHOPIFY. C'EST UN CHOIX, PAS UNE LIMITE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Shopify sait créer des commandes par API, et la tentation d'en créer une par vente Ma Zone
 * est forte : ce serait « complet ». Ce serait aussi entrer sans y être invité dans la
 * comptabilité d'un commerçant. Une commande Shopify porte un numéro dans une séquence
 * fiscale, apparaît dans ses rapports de chiffre d'affaires, déclenche ses courriels de
 * confirmation, entre dans ses déclarations. Y injecter des ventes réalisées ailleurs fausse
 * tout cela, et le commerçant n'a rien demandé.
 *
 * Ce que Ma Zone doit transmettre est plus modeste et exactement suffisant : « une unité de
 * cet article a quitté le rayon ». C'est un mouvement de stock. Le jour où un commerçant
 * voudra ses commandes Ma Zone dans son Shopify, ce sera une capacité déclarée en plus, avec
 * son consentement — pas un effet de bord du branchement.
 */
function fromCanonical(resource, canonical) {
  if (resource === 'order') {
    const quantity = Number(canonical.quantity) || 0;
    return {
      // Une annulation rend la marchandise au rayon : le signe s'inverse.
      delta: canonical.operation === 'annulation' ? quantity : -quantity,
      entityType: 'product',
      entityId: canonical.productId,
      reference: canonical.reference,
      note: `Ma Zone ${canonical.operation} ${canonical.orderId}`,
    };
  }

  if (resource === 'inventory') {
    return {
      delta: -(Number(canonical.quantity) || 0),
      entityType: canonical.entityType,
      entityId: canonical.entityId,
      reference: canonical.reference,
      note: `Ma Zone réservation ${canonical.runId || ''}`.trim(),
    };
  }

  return canonical;
}

module.exports = {
  referenceOf,
  nameOf,
  flattenProduct,
  stripHtml,
  toCanonical,
  fromCanonical,
};
