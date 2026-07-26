/**
 * API v1 — assemblage de la surface publique.
 *
 * Étape 7 de ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md. Cette étape arrive tard, et c'est
 * délibéré : les dix-huit fichiers de `routes/` exposent des tables. Écrire un contrat
 * public avant que les intentions existent aurait produit un contrat deviné, qu'il aurait
 * fallu casser à l'étape 5. On ne versionne que ce qui est passé derrière un organe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE `/api/v1` EST, ET CE QU'IL N'EST PAS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * C'est une surface d'INTENTIONS et de PROJECTIONS. Deux formes, et seulement deux :
 *
 *   · une intention — ce que quelqu'un veut obtenir, exécutée par l'orchestration,
 *     journalisée, compensée en cas d'échec partiel ;
 *   · une projection — un état, mis en forme POUR une audience.
 *
 * Ce n'est PAS un miroir de tables. Le risque est nommé dans l'audit de la roadmap, et il
 * n'est pas théorique : c'est ainsi que toutes les API « v2 » finissent par ressembler à
 * leur v1, une route pratique à la fois. La règle qui l'empêche est mécanique et se vérifie
 * en une commande : dans ce dossier, un verbe d'écriture n'apparaît que dans `intents.js`
 * — plus `inventory.js`, qui ne touche qu'un organe et le dit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI N'EST PAS ENCORE ICI, ET POURQUOI C'EST UNE FORCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ni messagerie, ni panier, ni portefeuille, ni identité, ni initiatives, ni transitions
 * de livraison. Ce n'est pas un manque de temps : aucun de ces domaines n'a d'organe avec
 * sa machine à états et son journal. La messagerie vit même en triple pile
 * (`/api/messages`, `/api/conversations`, `/api/communication`), ce qui rend la question
 * « quelle forme publier ? » sans réponse aujourd'hui.
 *
 * Publier une forme qu'on sait devoir refaire, c'est choisir entre s'interdire de la
 * refaire et casser sa propre promesse de stabilité. Un contrat court et vrai vaut mieux
 * qu'un contrat complet et provisoire. `/api` reste la porte de tout le reste jusqu'à sa
 * date de mort, inscrite dans `lib/sunset.js`.
 */

const express = require('express');

const intents = require('./intents');
const catalog = require('./catalog');
const inventory = require('./inventory');
const orders = require('./orders');
const deliveries = require('./deliveries');
const integrations = require('./integrations');

const router = express.Router();

/**
 * Version portée par chaque réponse.
 *
 * Un intégrateur qui débogue doit pouvoir vérifier quelle surface lui a répondu, sans
 * relire l'URL qu'il a peut-être composée par concaténation. C'est aussi ce qui rend
 * visible, dans un journal de requêtes, l'avancement de la bascule mobile.
 */
router.use((req, res, next) => {
  res.set('MaZone-Api-Version', 'v1');
  next();
});

/**
 * Le plan de la surface, DÉCLARÉ COMME UNE DONNÉE.
 *
 * Il serait plus court d'enchaîner six `router.use(...)`. Cette table existe parce que le
 * test de contrat de l'étape 7 doit comparer les routes RÉELLES au document OpenAPI, dans
 * les deux sens : une route non documentée est un contrat incomplet, une route documentée
 * mais absente est un mensonge. Pour comparer les routes réelles, il faut pouvoir les
 * énumérer — et les déduire des expressions régulières de montage d'Express serait un
 * test qui casse à la prochaine version du framework.
 *
 * Le catalogue est monté à la racine : ses ressources sont `/stores` et `/products`, pas
 * `/catalog/stores`. Un préfixe de domaine dans une URL publique exposerait notre
 * découpage interne, qui n'a aucune raison de concerner un appelant.
 */
const MOUNTS = [
  { prefix: '/intents', router: intents },
  { prefix: '/inventory', router: inventory },
  { prefix: '/orders', router: orders },
  { prefix: '/deliveries', router: deliveries },
  { prefix: '/integrations', router: integrations },
  { prefix: '', router: catalog },
];

for (const mount of MOUNTS) {
  router.use(mount.prefix || '/', mount.router);
}

/**
 * Les opérations réellement servies, en vocabulaire OpenAPI (`{param}`).
 *
 * Lu depuis la pile d'Express, donc toujours vrai : une route ajoutée sans être
 * documentée fait échouer le test de contrat le jour où elle est écrite, pas le jour où un
 * intégrateur la découvre par hasard.
 */
function operations() {
  const found = [];

  for (const { prefix, router: domain } of MOUNTS) {
    for (const layer of domain.stack) {
      if (!layer.route) continue;
      const path = `${prefix}${layer.route.path === '/' ? '' : layer.route.path}` || '/';
      for (const method of Object.keys(layer.route.methods)) {
        found.push({
          method: method.toUpperCase(),
          path: path.replace(/:([A-Za-z0-9_]+)/g, '{$1}'),
        });
      }
    }
  }

  return found.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

/**
 * 404 propre en fin de surface.
 *
 * Sans cela, `/api/v1/nimportequoi` tomberait dans le gestionnaire global d'Express et
 * renverrait du HTML à un client qui attend du JSON — une erreur de parsing chez lui, pour
 * une faute de frappe chez nous.
 */
router.use((req, res) => {
  res.status(404).json({
    error: `Route inconnue : ${req.method} /api/v1${req.path}`,
    hint: 'Contrat complet : backend/openapi/openapi.yaml',
  });
});

module.exports = router;
module.exports.operations = operations;
module.exports.MOUNTS = MOUNTS;
