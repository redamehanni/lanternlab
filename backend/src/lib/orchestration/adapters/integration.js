/**
 * Orchestration — adaptateur de l'organe Integration.
 *
 * L'organe Integration n'existe pas encore : il arrive à l'étape 6. Ces opérations
 * sont pourtant déjà nommées dans les plans, derrière une capacité (`requires`).
 * Elles ne sont donc JAMAIS exécutées aujourd'hui : aucune capacité n'est fournie,
 * et le process manager reporte l'étape à l'utilisateur (Loi 12).
 *
 * Pourquoi les déclarer maintenant plutôt qu'ajouter les étapes à l'étape 6 : parce
 * que le plan d'une vente doit dire la vérité complète sur ce qui devrait arriver, y
 * compris ce que Ma Zone ne sait pas encore faire. Un plan qui cache ses trous ne
 * permet pas de les voir.
 *
 * Si une de ces fonctions est un jour appelée sans organe derrière, elle lève : un
 * bouchon silencieux qui renvoie « ok » est le meilleur moyen de croire qu'une vente
 * a été transmise alors qu'elle n'est allée nulle part.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOI 16 — CE FICHIER EST L'UNIQUE POINT DE CONTACT AUTORISÉ, ET IL NE TRADUIT RIEN.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * L'Organe d'Orchestration ne dialogue JAMAIS directement avec un logiciel tiers.
 * Ce fichier NOMME des opérations canoniques. Il n'en connaît aucune mise en œuvre.
 *
 * Quand l'étape 6 branchera l'Integration Engine, ces trois fonctions deviendront des
 * délégations d'une ligne vers un organe. Ce qui NE DOIT PAS y apparaître :
 *
 *   INTERDIT ICI                          À SA PLACE
 *   ────────────────────────────────────  ──────────────────────────────────────
 *   `fetch`, client HTTP, SDK d'éditeur   connecteur
 *   OAuth, jeton, clé d'API, secret       connecteur
 *   mapping de champs, format de date     connecteur (`toCanonical`/`fromCanonical`)
 *   identifiant externe                   Integration Engine (`external_bindings`)
 *   webhook, signature                    Integration Engine
 *   outbox, réessai, backoff, DLQ         Integration Engine
 *   choix du connecteur, nom d'éditeur    Integration Engine (`connectorRegistry`)
 *   ordre d'appel imposé par un éditeur   `push()` du connecteur, JAMAIS un plan
 *
 * Le dernier point est le piège concret. Le premier connecteur réel dira « il faut
 * créer le client chez l'éditeur avant de pousser la commande ». Cette séquence est un
 * détail de connecteur : elle vit dans son `push()`. Le jour où un plan d'intention
 * porte l'ordre d'appel d'un éditeur, Ma Zone travaille pour cet éditeur et la
 * substitution progressive est morte.
 *
 * Cette frontière est la condition de la substitution progressive : retirer un logiciel
 * du commerçant doit rester un geste local sous la frontière — débrancher un
 * connecteur — jamais une modification au-dessus.
 */

/**
 * Les trois opérations, et l'endroit où un organe vient s'en charger.
 *
 * UN EMPLACEMENT VIDE, PAS UN IMPORT — c'est la décision structurante de ce fichier.
 * Écrire `require('../../integration')`, même paresseusement, ferait de l'orchestration
 * un dossier qui ne compile plus sans l'Integration Engine. En attendant qu'on se
 * déclare, ces emplacements refusent explicitement.
 *
 * L'inversion n'est pas un détail de style : c'est elle qui rend vraie la phrase
 * « supprimer `lib/integration/` laisse un système qui démarre et qui vend ». Le même
 * motif est déjà utilisé par `capabilities.js`, pour la même raison.
 */
const provided = new Map();

function notProvided(operation) {
  const err = new Error(
    `[Orchestration] « integration.${operation} » n'a pas d'organe déclaré. `
    + 'Cette étape doit rester conditionnée à une capacité (requires).'
  );
  // 501 et non 500 : ce n'est pas une panne, c'est une chose que Ma Zone ne sait pas
  // encore faire ici. La nuance change la réponse faite au commerçant.
  err.status = 501;
  throw err;
}

/**
 * Un organe se charge des opérations sortantes.
 *
 * Appelé par l'Integration Engine à son démarrage. Réappelable : un test qui rejoue le
 * démarrage ne doit pas se heurter à un refus.
 */
function provide(operations = {}) {
  for (const name of ['pushSale', 'pushCancel', 'pushStockMovement']) {
    if (typeof operations[name] !== 'function') {
      throw new Error(`[Orchestration] déclaration d'intégration incomplète : ${name} manquant`);
    }
    provided.set(name, operations[name]);
  }
  return [...provided.keys()];
}

function isProvided() {
  return provided.size > 0;
}

/** Oubli — tests uniquement. */
function forget() {
  provided.clear();
}

function slot(operation) {
  return (params, ctx) => {
    const impl = provided.get(operation);
    if (!impl) return notProvided(operation);
    return impl(params, ctx);
  };
}

module.exports = {
  provide,
  isProvided,
  forget,
  pushSale: slot('pushSale'),
  pushCancel: slot('pushCancel'),
  pushStockMovement: slot('pushStockMovement'),
};
