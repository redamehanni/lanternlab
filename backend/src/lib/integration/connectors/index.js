/**
 * Integration Engine — chargement des connecteurs.
 *
 * Chaque fichier s'auto-déclare dans le registre, comme les types d'événement et les
 * familles d'objets Wallet. Ajouter un connecteur = créer un fichier et l'importer ici.
 *
 * LOI 6 — TEST DE SUBSTITUTION. Cette liste est le seul endroit du système qui doit
 * changer pour retirer un connecteur. Si retirer une ligne d'ici casse un fichier situé
 * hors de `lib/integration/`, la frontière a été franchie quelque part et il faut la
 * réparer avant d'ajouter le connecteur suivant — pas après.
 */

require('./manual');

// ÉTAPE 8 — premier logiciel du marché, et la liste est faite pour s'allonger. Lightspeed,
// SumUp, Zettle, WooCommerce ou Sage viendront s'ajouter ici, chacun dans son dossier, sans
// qu'aucun autre fichier du dépôt ait à changer. Le jour où l'ajout d'un connecteur demande
// de toucher autre chose que cette ligne et son dossier, la frontière a bougé.
require('./shopify');
