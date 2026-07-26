/**
 * Orchestration — capacités disponibles pour une boutique.
 *
 * LOI 12 : ce qui manque se dit. Une étape de plan peut exiger une capacité
 * (`requires`). Si elle manque, l'étape n'échoue pas en silence et ne fait pas
 * échouer l'intention : elle est REPORTÉE à l'utilisateur, avec une phrase qu'un
 * commerçant comprend.
 *
 * À l'étape 5, aucune capacité externe n'existe : il n'y a pas encore de
 * connecteur. Ce module répond donc « non » à tout ce qui sort de Ma Zone, et c'est
 * la bonne réponse — pas une valeur en attente d'implémentation. L'étape 6 branchera
 * le registre de connecteurs derrière `resolvers`, sans toucher aux plans.
 *
 * LOI 16 — UNE CAPACITÉ EST ABSTRAITE, ET ELLE DOIT LE RESTER.
 *
 * Une capacité dit « cette boutique sait faire ceci ». Elle ne dit ni par quel
 * logiciel, ni par quel protocole, ni avec quelles autorisations. C'est ce qui permet à
 * l'Organe d'Orchestration de tenir compte d'un logiciel tiers sans jamais le
 * connaître : il lit une capacité, jamais sa cause.
 *
 * Un identifiant de capacité ne doit donc JAMAIS nommer un éditeur ni un protocole.
 * `push_sales` est licite ; `push_sales_<nom d'éditeur>` ou `push_sales_rest` ne le sont pas —
 * la première fuite de ce genre transformerait les plans d'intention en carte des
 * logiciels du marché, et la substitution progressive en réécriture du cœur.
 */

const CAPABILITIES = {
  /** Pousser une vente Ma Zone vers le logiciel du commerçant. */
  push_sales: {
    label: 'Envoi des ventes vers votre logiciel',
    missing: 'Vos ventes Ma Zone ne sont pas encore envoyées à votre logiciel de caisse.',
  },
  /** Pousser un mouvement de stock Ma Zone vers le logiciel du commerçant. */
  push_inventory: {
    label: 'Envoi des stocks vers votre logiciel',
    missing: 'Vos mouvements de stock ne sont pas encore envoyés à votre logiciel.',
  },
  /** Recevoir le stock du logiciel du commerçant. */
  pull_inventory: {
    label: 'Réception des stocks depuis votre logiciel',
    missing: 'Ma Zone ne reçoit pas encore vos stocks depuis votre logiciel.',
  },
};

const CAPABILITY_IDS = Object.keys(CAPABILITIES);

/**
 * Résolveurs branchés par les organes qui savent répondre.
 *
 * Volontairement un registre mutable et non un `require` direct : l'orchestration
 * ne doit pas dépendre de l'organe Integration, qui n'existe pas encore. C'est
 * Integration qui viendra se déclarer, à l'étape 6.
 */
const resolvers = new Map();

function assertKnown(capability) {
  if (!CAPABILITIES[capability]) {
    throw new Error(
      `[Orchestration] Capacité inconnue « ${capability} » — `
      + `capacités déclarées : ${CAPABILITY_IDS.join(', ')}.`
    );
  }
}

/** Branche un résolveur. Appelé par l'organe qui fournit la capacité. */
function registerResolver(capability, resolver) {
  assertKnown(capability);
  if (typeof resolver !== 'function') {
    throw new Error('[Orchestration] un résolveur de capacité doit être une fonction');
  }
  resolvers.set(capability, resolver);
}

/**
 * La capacité est-elle disponible dans ce contexte ?
 *
 * Sans résolveur : `false`. C'est un choix, pas un oubli — une capacité dont
 * personne ne se déclare responsable n'est pas disponible.
 */
function has(capability, context = {}) {
  assertKnown(capability);
  const resolver = resolvers.get(capability);
  if (!resolver) return false;
  try {
    return !!resolver(context);
  } catch {
    // Un résolveur en panne signifie « je ne sais pas », donc « non ».
    return false;
  }
}

/** Phrase destinée au commerçant quand la capacité manque (Loi 12). */
function explainMissing(capability) {
  assertKnown(capability);
  return CAPABILITIES[capability].missing;
}

/** Remise à zéro — tests uniquement. */
function reset() {
  resolvers.clear();
}

module.exports = {
  CAPABILITIES,
  CAPABILITY_IDS,
  registerResolver,
  has,
  explainMissing,
  assertKnown,
  reset,
};
