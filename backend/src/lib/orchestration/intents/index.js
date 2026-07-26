/**
 * Orchestration — chargement des intentions.
 *
 * Chaque fichier s'auto-déclare dans le registre, comme les types d'événement et les
 * familles d'objets Wallet. Ajouter une intention = créer un fichier et l'importer ici.
 *
 * Ce `require` est ce qui déclenche la validation fail-fast : une intention mal
 * déclarée empêche le serveur de démarrer, au lieu d'échouer devant un utilisateur.
 */

require('./orderPlace');
require('./orderCancel');
require('./productReserve');
require('./storeCloseExceptionally');
require('./eventClaimOpportunity');
require('./catalogDeclareProduct');
