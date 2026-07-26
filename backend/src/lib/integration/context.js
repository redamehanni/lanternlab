/**
 * Integration Engine — ce qu'un connecteur reçoit pour travailler.
 *
 * Un connecteur ne va RIEN CHERCHER lui-même. Il ne lit pas la base, n'ouvre pas le coffre,
 * ne fabrique pas de client HTTP, ne connaît pas la configuration du serveur. Tout ce dont
 * il a besoin lui est remis dans un objet de contexte, construit ici, et cette inversion
 * est ce qui rend la famille de connecteurs tenable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS CONSÉQUENCES, ET AUCUNE N'EST THÉORIQUE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. UN CONNECTEUR EST TESTABLE HORS LIGNE. On lui donne un contexte dont `request` est une
 *    fonction qui répond ce que le test veut — dont des pannes et des 429, que l'on ne sait
 *    pas provoquer chez un vrai éditeur au moment où on en a besoin.
 * 2. LES SECRETS NE TRAÎNENT PAS. Ils sont déchiffrés PARESSEUSEMENT : un connecteur qui
 *    n'en a pas besoin ne les fait jamais sortir du coffre, et une instance sans coffre
 *    continue de faire tourner les connecteurs qui n'en exigent pas.
 * 3. UN CONTEXTE JOURNALISÉ NE FUIT PAS. `toJSON` masque les identifiants : sans cela, un
 *    `logger.reportError('...', err, { ctx })` écrit un jeton d'éditeur en clair dans les
 *    journaux, et personne ne s'en aperçoit avant l'audit.
 *
 * LOI 16 — ce fichier ne nomme aucun éditeur. Il ne sait même pas ce que contiennent les
 * secrets qu'il transmet : leurs noms sont déclarés par le connecteur.
 */

const http = require('./http');
const secrets = require('./secrets');
const bindings = require('./bindings');
const installations = require('./installations');

/**
 * Contexte d'appel pour une installation.
 *
 * @param {object} params
 * @param {object} params.connector
 * @param {object} params.installation ligne de `integration_installations`
 * @param {object} [params.extra]      champs propres à l'appel (operation, idempotencyKey…)
 */
function forInstallation({ connector, installation, extra = {} }) {
  const storeId = installation.store_id;
  const connectorId = installation.connector_id;

  let loaded = null;

  const ctx = {
    storeId,
    connectorId,
    config: installation.config || {},
    ...extra,

    /**
     * Le seul accès réseau d'un connecteur.
     *
     * Passe par le transport du processus, donc par ses délais, sa politique de quota et sa
     * classification des échecs. Un connecteur qui appellerait `fetch` directement
     * contournerait les trois — et la suite de conformité le refuse pour cette raison.
     */
    request: (spec) => http.transport().request(spec),

    /**
     * « Comment ce logiciel nomme-t-il mon produit ? »
     *
     * La seule question qu'un connecteur a le droit de poser sur les correspondances. Il ne
     * lit pas `external_bindings` : cette table appartient au moteur, et un connecteur qui la
     * lirait en deviendrait un second usager — puis, un jour, un second écrivain.
     *
     * Renvoie `null` sans lever quand rien n'est apparié. Ce n'est pas une panne : c'est un
     * produit Ma Zone qui n'existe pas encore chez l'éditeur, et c'est au connecteur de dire
     * ce qu'il en fait.
     */
    externalIdFor({ entityType, entityId }) {
      if (!entityType || !entityId) return null;
      const rows = bindings.forEntity(entityType, entityId);
      return rows.find((row) => row.connector_id === connectorId) || null;
    },

    /**
     * Enregistre ce que le connecteur vient d'apprendre de non secret.
     *
     * Le connecteur DÉCLARE, le moteur ÉCRIT. C'est la Loi 2 appliquée à un détail qui aurait
     * été facile à laisser passer : sans cette fonction, un connecteur ayant besoin de
     * retenir l'établissement par défaut de la boutique aurait fini par importer la base.
     */
    updateConfig(patch = {}) {
      const updated = installations.updateConfig({ storeId, connectorId, patch });
      ctx.config = updated.config || {};
      return ctx.config;
    },

    /**
     * Identifiants du commerçant chez son éditeur, déchiffrés à la première lecture.
     *
     * Un getter et non une valeur : construire un contexte ne doit pas être une opération de
     * déchiffrement. Beaucoup de contextes sont construits pour des connecteurs qui n'ont
     * aucun secret, et beaucoup d'autres pour des appels qui échoueront avant d'en avoir
     * besoin.
     */
    get credentials() {
      if (loaded === null) {
        loaded = connector.requiresAuth ? secrets.readAll({ storeId, connectorId }) : {};
      }
      return loaded;
    },

    /** Journalisable sans risque : les identifiants n'en font pas partie. */
    toJSON() {
      return { storeId, connectorId, config: installation.config || {} };
    },
  };

  return ctx;
}

module.exports = { forInstallation };
