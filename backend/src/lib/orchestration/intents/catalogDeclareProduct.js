/**
 * Intention — faire entrer un article dans le catalogue d'une boutique.
 *
 * L'intention qui fait exister un commerçant dans Ma Zone. Sans elle, un commerçant avec
 * quatre cents références devait les saisir une par une, et n'arrivait jamais au bout.
 *
 * POURQUOI C'EST UNE INTENTION ET NON UN APPEL D'ORGANE. Déclarer un article touche
 * DEUX organes : le Catalog le fait exister, l'Inventory lui donne son stock vendable. Dès
 * qu'une action touche deux organes, elle devient une intention déclarée (Loi 5). C'est
 * aussi ce qui empêche le moteur d'intégration d'enchaîner ces deux appels lui-même : le
 * séquencement n'est pas son travail, et une double vérité sur l'ordre des gestes est
 * exactement ce que la Loi 5 existe pour éviter.
 *
 * Formulée par un commerçant depuis l'Épée, ou par `system` quand un import de fichier
 * la formule pour lui. La distinction reste dans le rôle de l'auteur, jamais dans le plan.
 *
 * AUCUNE COMPENSATION, ET C'EST RÉFLÉCHI. Si le stock échoue après la création, on ne
 * supprime pas le produit : il peut préexister à l'import (l'opération est un upsert), et
 * le détruire ferait perdre son historique et ses correspondances externes pour une
 * raison qui n'a rien à voir avec lui. Un produit sans stock n'est pas vendable — donc
 * inoffensif — et le commerçant le voit dans sa liste avec zéro.
 */

const { defineIntent } = require('../intentRegistry');

defineIntent({
  id: 'catalog.declare_product',
  label: 'Déclarer un article au catalogue',
  actors: ['merchant', 'system', 'admin'],
  params: {
    storeId: 'string',
    // La référence apparie les imports successifs. Sans elle, réimporter le même
    // fichier créerait une seconde fois les mêmes articles.
    reference: 'string',
    name: 'string',
    quantity: 'integer',
    price: 'number?',
    category: 'string?',
    description: 'string?',
  },
  plan: () => [
    { organ: 'catalog', action: 'declareProduct', compensate: null },
    { organ: 'inventory', action: 'declareSellable', compensate: null },
  ],
});
