# Décisions à trancher — Conformité Ma Zone

Avant correctifs P1 de rétention et avant publication des textes légaux.  
À valider par Adam (et Reda si architecture).

---

## D1 — Socle de données en production

| Option | Conséquence |
|--------|-------------|
| A. SQLite auto-hébergé (continuité actuelle) | Maîtrise ; responsabilité hébergement + backups |
| B. Postgres managé UE (Supabase/autre) | Sous-traitant + DPA ; RLS à porter |
| C. Hybride | Complexité registre / transferts |

**Décision :** ☐ A  ☐ B  ☐ C  
**Date / qui :** ________

---

## D2 — Bases légales Mode Réception / opportunités par distance

| Option | Conséquence |
|--------|-------------|
| A. Consentement opt-in | Case + preuve `consents` ; retrait facile |
| B. Intérêt légitime | Analyse LIA documentée ; droit d’opposition |

**Décision :** ☐ A  ☐ B  
**Date / qui :** ________

---

## D3 — Âge minimum d’inscription

France : 15 ans pour consentement numérique (art. 8 RGPD).  
**Proposition :** 18 ans (livraison + place de marché) sauf décision contraire.

**Décision :** ☐ 18 ans  ☐ 15 ans  ☐ Autre : ___  
**Date / qui :** ________

---

## D4 — AIPD (analyse d’impact)

Facteurs : messagerie + adresses/géoloc + ciblage distance + (futur) suivi livreurs.

**Décision :** ☐ AIPD formelle avant prod  ☐ Pas d’AIPD (motivée)  ☐ AIPD après bêta fermée  
**Date / qui :** ________

---

## D5 — Durées de conservation (propositions)

| Catégorie | Proposition | Décision |
|-----------|-------------|----------|
| Compte inactif | 24 mois puis anonymisation | ☐ OK ☐ Autre |
| Commandes | 13 mois puis anonymisation (litiges) | ☐ OK ☐ Autre |
| Messages commande | 12 mois après archivage | ☐ OK ☐ Autre |
| Logs techniques | 6–12 mois | ☐ OK ☐ Autre |
| Journaux append-only | Anonymisation subject_id à l’effacement | ☐ OK ☐ Autre |
| Jetons intégration | Jusqu’au disconnect | ☐ OK (déjà) |

---

## D6 — Inscription commerçant / livreur

| Option | |
|--------|--|
| A. Self-register ouvert (état actuel) | Risque abus |
| B. Client only + validation (recommandé audit) | |

**Décision :** ☐ A  ☐ B  
**Date / qui :** ________

---

## D7 — Identité éditeur (bloquant mentions légales)

Fournir : raison sociale, forme, SIREN, RCS, siège, capital, email, directeur publication, hébergeur, médiateur.

**Statut :** ☐ Pas encore immatriculé (placeholders)  ☐ Fiche identité jointe

---

## D8 — Prestataire d'envoi d'email (bloquant P0-8)

Aucun service d'envoi n'est branché aujourd'hui. Sans lui, il n'y a ni réinitialisation de mot de passe, ni vérification d'adresse, ni notification d'exercice des droits. Le prestataire retenu devient un **sous-traitant** à inscrire au registre et à couvrir par un contrat article 28 ; s'il héberge hors Union européenne, un encadrement des transferts est requis.

| Option | Point d'attention |
|--------|-------------------|
| A. Prestataire européen | Transferts simplifiés |
| B. Prestataire hors UE | Clauses contractuelles types à documenter |
| C. Serveur d'envoi auto-hébergé | Charge d'exploitation et délivrabilité |

**Décision :** ☐ A  ☐ B  ☐ C — prestataire : ________  
**Date / qui :** ________

---

## D9 — Sort du site Next.js legacy (bloquant trois écarts P0)

FD-000 indique que `src/` n'est pas le produit et ne doit pas être développé. Le code reste pourtant dans le dépôt, déployable, avec `vercel.json` prêt. La revue des surfaces exposables ([07](./07-SURFACES-EXPOSABLES.md)) y a trouvé **trois écarts P0** : authentification entièrement contournée sans configuration Supabase (S-02), rôle non vérifié malgré la session (S-03), injection HTML dans les marqueurs de carte (S-15) — plus trois P1.

Le point à comprendre : déclarer ce code « hors périmètre » ne réduit pas le risque d'un iota. Un déploiement accidentel ouvre les espaces commerçant et livreur à n'importe quel visiteur. Seules la suppression ou la correction protègent.

| Option | Conséquence |
|--------|-------------|
| A. Retirer `src/`, `supabase/` et `vercel.json` du dépôt | Trois P0 et trois P1 disparaissent ; plus rien à entretenir ; l'historique Git conserve le code si besoin |
| B. Le corriger au même niveau que le reste | Coût réel : middleware de rôle, échec au démarrage sans configuration, échappement, en-têtes, actions serveur protégées |
| C. Le garder tel quel en le déclarant hors périmètre | **Non défendable** — le risque reste entier et l'audit le signale |

**Décision :** ☐ A  ☐ B  ☐ C  
**Date / qui :** ________

---

## D10 — Sort du mécanisme `labToken`

`mobile/src/context/AppContext.js` ouvre une session complète à partir d'un jeton reçu dans une URL, sans garde de production. C'est l'écart le plus grave de tout l'audit (S-01). Le mécanisme a été écrit pour le confort du Bac à Sable et il fonctionne bien pour cela ; le problème est qu'il est compilé dans le build livré.

| Option | Conséquence |
|--------|-------------|
| A. Supprimer purement le mécanisme | Le laboratoire perd l'ouverture en un clic ; il faut se connecter normalement |
| B. Le conserver derrière `__DEV__` ou une variable de build | Le confort reste en développement, le risque disparaît en production — **à condition de vérifier que le code est bien éliminé du bundle, pas seulement inatteignable** |
| C. Jeton d'imitation marqué côté serveur (`imp: true`, courte durée, usage unique) refusé par un build de production | Plus robuste, plus coûteux ; utile si le laboratoire doit un jour fonctionner sur un environnement de recette |

**Décision :** ☐ A  ☐ B  ☐ C  
**Date / qui :** ________
