# FD-003 — Décisions prioritaires pour l'objectif déployable

| | |
|---|---|
| **Statut** | brouillon |
| **Date** | 2026-07-24 |
| **Auteur(s)** | Adam (AdamY76) — proposée via Cursor Adam |
| **Phase / chantier** | Alignement Reda ↔ Adam avant trajectoire prod |
| **Références** | [FD-002](./FD-002-diagnostic-prod-et-stocks-commercants.md), [FD-000](./FD-000-systeme-fiches-discussion.md), [PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md](../PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md) |

---

> **Statut de cette liste — à lire avant tout le reste**  
> Cette fiche est une **proposition** du Cursor d'Adam, fondée sur le diagnostic FD-002 et la conversation du 24/07/2026.  
> Elle **n'est pas encore validée** comme liste définitive.  
> **Le Cursor de Reda** (et Reda) doivent la **croiser avec ce qu'ils savent déjà du projet** : décisions déjà prises ailleurs, contraintes non visibles côté Adam, priorités produit, dette connue, engagements en cours.  
> Après croisement : amender, supprimer, réordonner, puis passer le statut à **validé**.

---

## 1. Contexte

Adam et Reda avancent chacun avec son Cursor sur le même repo. FD-002 a posé le diagnostic (labo riche, zéro-production) et le chantier stocks.  
Sans **décisions actées à deux**, les assistants risquent de coder dans des directions divergentes (legacy web, inventaire, sécurité, paiement…).

Cette fiche liste les **choix** à trancher pour que le projet avance vers un produit professionnel et déployable.

---

## 2. Vision & philosophie

Ma Zone reste une plateforme de **vie locale** (Première Âme marketplace + Deuxième Âme vie de quartier).  
L'objectif de cette phase n'est pas d'enrichir la vision, mais de **choisir le périmètre et l'ordre** qui rendent le produit **réellement déployable** sans perdre l'âme du projet.

Rappels (FD-001) : surface compose, organe décide ; sandbox ≠ prod ; pas de dérive silencieuse.

---

## 3. Objectif

Disposer d'une **liste de décisions priorisées**, validée par Reda + Adam (après croisement des deux Cursor), qui débloque :

1. la Phase 0 / sécurité ;
2. le périmètre MVP prod ;
3. le chantier stocks / commerçants ;
4. l'hébergement et le paiement.

---

## 4. Périmètre

### Inclus

- Décisions structurantes produit / stack / marché
- Décisions business (paiement, stock, modèle)
- Décisions techniques / ops
- Décisions de gouvernance duo (workflow Cursor + Git)
- Proposition d'ordre « minimum vital cette semaine »

### Hors périmètre

- Implémentation code
- ADR techniques détaillés (schémas SQL, routes)
- Remplacement de FD-002 (cette fiche **enchaîne** sur FD-002)

---

## 5. Principes directeurs (proposition)

1. **Trancher avant de coder** les points §6 — surtout le minimum vital §8.
2. **Une seule source de vérité produit** une fois actée (éviter double stack).
3. **Première Âme opérationnelle avant enrichissements** (Wallet avancé / Deuxième Âme / labo) — *à confirmer avec Reda*.
4. **Phase 0 sécurité avant gros chantiers métier** — *recommandation FD-002, à valider*.
5. **Cette liste peut être réduite** : si le Cursor Reda sait qu'un point est déjà tranché, le sortir de « ouvert » et le mettre en §7.

---

## 6. Liste des décisions importantes (proposition)

### 6.1 Structurantes (à faire d'abord)

| # | Décision | Pourquoi ça bloque sinon | Proposition Cursor Adam (non actée) |
|---|----------|--------------------------|-------------------------------------|
| D1 | **Source de vérité produit** : mobile+Node seul, ou web Next.js en parallèle / archivé ? | Double stack = double charge, confusion README/Vercel | Produit = mobile + backend Node ; archiver UI Next.js |
| D2 | **Base de données prod** : rester SQLite un temps, ou viser Postgres (schéma Supabase) ? | Impact hébergement, backups, concurrence stock | Garder schéma Supabase comme cible Postgres ; timing à trancher (D11) |
| D3 | **Zone / marché pilote** (quartier, types de commerces, taille flotte livreurs) | Sans ça : POS, onboarding, features mal priorisés | À définir ensemble (pas de proposition figée) |
| D4 | **Périmètre MVP déployable** : commande→paiement→dispatch→livraison seulement, ou aussi Wallet / Identity / 2e Âme / sandbox ? | Scope trop large = jamais prêt | Première Âme opérationnelle d'abord |

### 6.2 Business / produit

| # | Décision | Pourquoi | Proposition Cursor Adam (non actée) |
|---|----------|----------|-------------------------------------|
| D5 | **PSP** (Stripe ou autre) | Sans paiement réel, pas de confiance | Stripe (à confirmer) |
| D6 | **Niveau autonomie stock au lancement** (manuel+scan+CSV vs connecteurs POS) | Adoption commerçants | Niveau 1 d'abord ; POS après |
| D7 | **Source de vérité stock** : Ma Zone ou caisse commerçant ? | Change toute l'archi inventaire | POS = vérité aux niveaux 2–3 ; Ma Zone = miroir |
| D8 | **Modèle économique V0** (commission, abo, frais livraison) | Cadre wallet / reçus / litiges | Écrire une V0 même courte |
| D9 | **Support & litiges** : qui traite, quel process minimal | Premier incident en prod sans process = crise | Process + outil minimum avant ouverture |

### 6.3 Techniques / ops

| # | Décision | Pourquoi | Proposition Cursor Adam (non actée) |
|---|----------|----------|-------------------------------------|
| D10 | **Hébergeur backend** + HTTPS/WSS + env dev/staging/prod | Sans ça, pas de déploiement | À choisir (Railway / Render / Fly / VM…) |
| D11 | **Quand migrer SQLite → Postgres** | Avant 1er public vs après pilote ultra-restreint | Avant public si multi-users ; sinon pilote fermé SQLite OK temporairement |
| D12 | **Stores** : iOS seul d'abord, ou iOS+Android | Effort certificats / délais | À trancher selon capacité |
| D13 | **Bac à sable / World Factory en prod** | Sécurité (impersonation) | Interdit hors staging ; admin verrouillé |
| D14 | **Ordre des chantiers** entre les deux Cursor | Éviter divergence | Phase 0 sécurité → puis (tests dispatch **ou** inventaire) selon choix commun |

### 6.4 Gouvernance duo

| # | Décision | Pourquoi | Proposition Cursor Adam (non actée) |
|---|----------|----------|-------------------------------------|
| D15 | **Canal officiel** = `FICHE_DISCUSSION/` + workflow pull/branche | FD-000/001 le posent déjà | Confirmer : fiches validées = référence ; `git pull` avant chantier |
| D16 | **Critère « prêts à déployer »** (checklist mesurable) | Évite le « on verra » | Ex. : parcours E2E, paiement, secrets hors code, staging, CGU, sandbox off |

---

## 7. Décisions actées

| Date | Décision | Par |
|------|----------|-----|
| — | *Aucune décision de cette liste n'est encore actée.* | — |

*(Les décisions déjà actées ailleurs — FD-000, FD-001, produit vivant mobile+Node dans FD-002 — restent valides ; cette fiche ne les remplace pas.)*

---

## 8. Minimum vital proposé pour cette semaine

À valider / amender avec Reda :

1. **D1** — sort du web Next.js  
2. **D2** — intention Postgres (même si migration plus tard)  
3. **D4** — périmètre MVP prod  
4. **D5** — PSP  
5. **D6** — niveau stock au lancement  
6. **D10** — hébergeur / env  
7. **D14** — ordre des chantiers entre les deux postes  

---

## 9. Questions ouvertes pour le Cursor de Reda

- Quels points de cette liste sont **déjà tranchés** dans l'historique Reda (conversations, tags, plans) et absents de FD-002 ?
- Y a-t-il des **contraintes** (délais, partenaires commerçants, zone pilote déjà choisie, budget) qui invalident certaines propositions ?
- Faut-il **fusionner** certaines décisions avec une fiche vision produit plus large (ex. modèle économique) plutôt que tout traiter ici ?
- Confirmer ou corriger l'ordre Phase 0 → métier.

---

## 10. Étapes proposées

| # | Étape | Livrable | Statut |
|---|-------|----------|--------|
| 1 | Publier ce brouillon sur `main` pour lecture Reda | FD-003 | en cours |
| 2 | Cursor Reda croise / amende la liste | Commentaires ou PR / mise à jour fiche | à faire |
| 3 | Reda + Adam valident la liste amendée | Statut → **validé** | à faire |
| 4 | Enchaîner Phase 0 ou ADR selon D14 | Code / ADR | bloqué par étape 3 |

---

## 11. Notes pour les deux Cursor

- **Cursor Adam** : a proposé cette liste ; ne pas implémenter D1–D16 tant que le statut reste `brouillon`.
- **Cursor Reda** : lire FD-002 puis cette fiche ; **amender selon ta connaissance du projet** ; ne pas traiter cette liste comme vérité absolue.
- Une fois validée : les décisions actées doivent remonter en §7 (et éventuellement une ligne dans FD-002 §9/§10 si elles ferment des questions ouvertes).

---

*Fiche générée depuis `_TEMPLATE.md` — proposition Adam ; à croiser et valider avec Reda / Cursor Reda avant passage au statut validé.*
