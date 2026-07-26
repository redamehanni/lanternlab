/**
 * Organe d'Orchestration — façade.
 *
 * Une seule porte d'entrée : `orchestration.run('order.place', params, context)`.
 *
 * LOI 5 — ce module n'est PAS un passage obligé. Une action qui ne concerne qu'un
 * organe s'adresse à cet organe directement. Le registre refuse d'ailleurs de
 * déclarer une intention mono-organe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOI 16 — CET ORGANE NE DIALOGUE JAMAIS AVEC UN LOGICIEL TIERS.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Il orchestre des INTENTIONS MÉTIER, et rien d'autre. Il nomme des opérations
 * canoniques ; il ne sait pas ce qu'elles deviennent.
 *
 * N'ont RIEN à faire dans ce dossier, aujourd'hui ni jamais :
 *   · un appel réseau sortant, un client HTTP, un SDK ;
 *   · une authentification externe, un jeton, une clé d'API, un secret d'éditeur ;
 *   · une traduction de format, un mapping de champs, un `toCanonical` ;
 *   · un identifiant externe, une ligne d'`external_bindings` ;
 *   · un webhook, une signature, une vérification d'origine ;
 *   · une file d'attente, un réessai, une DLQ, une réconciliation ;
 *   · le nom d'un éditeur commercial, même en commentaire.
 *
 * Tout cela appartient EXCLUSIVEMENT à l'Integration Engine et aux connecteurs.
 *
 * Ce que l'orchestration a le droit de connaître : un nom d'opération canonique
 * (`integration.pushSale`) et une CAPACITÉ abstraite (`push_sales`). Une capacité dit
 * « cette boutique sait faire ceci ». Elle ne dit ni par quel logiciel, ni par quel
 * protocole, ni avec quelles autorisations.
 *
 * FORMULATION VÉRIFIABLE : si l'on supprimait tout `lib/integration/`, cet organe
 * devrait continuer à démarrer et à exécuter ses plans, les étapes `integration.*`
 * étant simplement reportées à l'utilisateur (Loi 12). C'est le cas depuis l'étape 5.
 *
 * POURQUOI CETTE FRONTIÈRE EST FONDAMENTALE : elle est la condition de la
 * SUBSTITUTION PROGRESSIVE. La stratégie de Ma Zone est de remplacer, organe par
 * organe, les logiciels du commerçant par les siens. Cela n'est possible que si
 * retirer un logiciel tiers reste un geste local — débrancher un connecteur. Le jour
 * où un plan d'intention suppose l'existence d'un logiciel externe (un identifiant,
 * un format, un ordre d'appel imposé par un éditeur), la substitution cesse d'être un
 * débranchement et devient une réécriture du cœur. C'est ainsi que les plateformes
 * d'intégration deviennent prisonnières des outils qu'elles prétendaient absorber :
 * non par une grande décision, mais par vingt petites commodités.
 *
 * Vérifié structurellement dans `test/orchestration.test.js` et en CI.
 */

require('./intents');

const registry = require('./intentRegistry');
const processManager = require('./processManager');
const capabilities = require('./capabilities');
const organs = require('./organs');
const journal = require('./journal');
const integrationSlot = require('./adapters/integration');

module.exports = {
  run: processManager.run,
  history: processManager.history,
  incomplete: processManager.incomplete,
  IntentError: processManager.IntentError,
  RUN_STATUS: processManager.RUN_STATUS,

  describe: registry.describe,
  forActor: registry.forActor,
  has: registry.has,
  ids: registry.ids,

  registerCapability: capabilities.registerResolver,
  // Ancien nom, conservé le temps que rien ne l'appelle plus.
  registerCapabilityResolver: capabilities.registerResolver,
  hasCapability: capabilities.has,
  CAPABILITIES: capabilities.CAPABILITIES,

  /**
   * Reçoit les opérations qui sortent de Ma Zone.
   *
   * LOI 16 — l'orchestration ne va JAMAIS chercher l'Integration Engine : c'est lui qui
   * vient se déclarer. Cette inversion est ce qui garantit que supprimer
   * `lib/integration/` laisse un système qui démarre et qui vend, en signalant simplement
   * ce qui n'a pas pu être transmis (Loi 12).
   *
   * Tant que personne ne se déclare, les étapes `integration.*` échouent explicitement
   * plutôt que de réussir en silence — voir `adapters/integration.js`.
   */
  provideIntegration: integrationSlot.provide,
  integrationProvided: integrationSlot.isProvided,

  describeOrgans: organs.describe,
  journal,
};
