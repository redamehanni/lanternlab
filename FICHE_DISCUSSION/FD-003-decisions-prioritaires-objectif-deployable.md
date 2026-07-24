# FD-003 — Décisions prioritaires pour l'objectif déployable

| | |
|---|---|
| **Statut** | brouillon |
| **Date** | 2026-07-24 |
| **Auteur(s)** | Adam (AdamY76) — proposée via Cursor Adam |
| **Phase / chantier** | Alignement Reda ↔ Adam avant trajectoire prod |
| **Références** | [FD-004](./FD-004-contexte-complet-projet-adam.md) (état code à jour), [FD-002](./FD-002-diagnostic-prod-et-stocks-commercants.md), [FD-000](./FD-000-systeme-fiches-discussion.md), [PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md](../PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md) |

---

> **Statut de cette liste — à lire avant tout le reste**  
> Cette fiche est une **proposition** du Cursor d'Adam, fondée sur le diagnostic FD-002 et la conversation du 24/07/2026.  
> Elle **n'est pas encore validée** comme liste définitive.  
> **Croisement Reda (24/07/2026) :** amendée pour refléter l'état code v0.9.5.2 — voir surtout [FD-004](./FD-004-contexte-complet-projet-adam.md). FD-003 et FD-004 sont **complémentaires** : FD-004 = état réel du projet ; FD-003 = décisions deploy à trancher.  
> **Le Cursor de Reda** (et Reda) doivent encore valider la liste amendée §6–§8.  
> Après validation finale : passer le statut à **validé**.

---

## 1. Contexte

Adam et Reda avancent chacun avec son Cursor sur le même repo. FD-002 a posé le diagnostic (labo riche, zéro-production) et le chantier stocks.  
Sans **décisions actées à deux**, les assistants risquent de coder dans des directions divergentes (legacy web, inventaire, sécurité, paiement…).

Cette fiche liste les **choix** à trancher pour que le projet avance vers un produit professionnel et déployable.

**Complémentarité FD-004 :** FD-004 documente ce qui **existe déjà** (organes, Deuxième Âme v1, labo). FD-003 documente ce qui reste **à décider** pour la prod — sans remettre en cause l'implémentation passée.

---

## 2. Vision & philosophie

Ma Zone reste une plateforme de **vie locale** (Première Âme marketplace + Deuxième Âme vie de quartier).  
L'objectif de cette phase n'est pas d'enrichir la vision, mais de **choisir le périmètre et l'ordre** qui rendent le produit **réellement déployable** sans perdre l'âme du projet.

**État code (v0.9.5.2) — aligné FD-004 :** la Deuxième Âme n'est **plus** une vision ou un concept futur. Face client v1, **Event Engine**, Mode Réception, Opportunités Volantes, **6 portes**, Murmures, Design System AME et parcours Épée associés sont **implémentés** (tags `v0.9.3` → `v0.9.5.2`). Le **Laboratoire** (World Factory, impersonation web + iOS) est opérationnel en sandbox.  
Les décisions de cette fiche portent donc sur **l'exposition en production v1** et le **durcissement**, pas sur « construire ou non » la Deuxième Âme.

Rappels (FD-001 / FD-004) : surface compose, organe décide ; sandbox ≠ prod ; pas de dérive silencieuse.

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

1. **Trancher avant de coder** les points §6 encore ouverts — surtout le minimum vital §8.
2. **Une seule source de vérité produit** une fois actée (éviter double stack).
3. **Première Âme déployable en prod en priorité** — Wallet, Identity, Deuxième Âme v1 et le labo **existent déjà** ([FD-004](./FD-004-contexte-complet-projet-adam.md) §8–17) ; la décision porte sur le **périmètre prod v1** (inclus / gel / staging) et l'ordre des durcissements, **pas** sur la construction de la Deuxième Âme.
4. **Phase 0 sécurité avant gros chantiers métier** — recommandation FD-002, toujours pertinente.
5. **Cette liste peut être réduite** : points déjà actés ailleurs → §7 (voir croisement Reda 24/07).

---

## 6. Liste des décisions importantes (proposition)

### 6.1 Structurantes (à faire d'abord)

| # | Décision | Pourquoi ça bloque sinon | Proposition Cursor Adam (non actée) |
|---|----------|--------------------------|-------------------------------------|
| D1 | **Source de vérité produit** : mobile+Node seul, ou web Next.js en parallèle / archivé ? | Double stack = double charge, confusion README/Vercel | Produit = mobile + backend Node ; archiver UI Next.js |
| D2 | **Base de données prod** : rester SQLite un temps, ou viser Postgres (schéma Supabase) ? | Impact hébergement, backups, concurrence stock | Garder schéma Supabase comme cible Postgres ; timing à trancher (D11) |
| D3 | **Zone / marché pilote** (quartier, types de commerces, taille flotte livreurs) | Sans ça : POS, onboarding, features mal priorisés | À définir ensemble (pas de proposition figée) |
| D4 | **Périmètre MVP déployable (prod v1)** : parcours Première Âme seul, ou aussi Wallet / Identity / Deuxième Âme v1 ? | Scope trop large = jamais prêt ; **2e Âme v1, Event Engine et labo sont déjà codés** (FD-004) — la décision porte sur l'**exposition prod**, pas la construction | Parcours commande→paiement→livraison **obligatoire** ; Wallet / Identity / 2e Âme v1 : **à trancher** (inclus prod v1 vs gel maintenance vs staging-only) |

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
| D13 | **Bac à sable / World Factory en prod** | Sécurité (impersonation) | **Interdit hors staging** — aligné FD-004 §17 ; verrouillage `SANDBOX_MODE` à acter en Phase 0 |
| D14 | **Ordre des chantiers** entre les deux Cursor | Éviter divergence | Phase 0 sécurité → puis (tests dispatch **ou** inventaire) selon choix commun |

### 6.4 Gouvernance duo

| # | Décision | Pourquoi | Proposition Cursor Adam (non actée) |
|---|----------|----------|-------------------------------------|
| D15 | **Canal officiel** = `FICHE_DISCUSSION/` + workflow pull/branche | FD-000/001/004 le posent déjà | **Acté** — FD-004 lecture obligatoire Cursor Adam ; fiches validées = référence ; `git pull` avant chantier |
| D16 | **Critère « prêts à déployer »** (checklist mesurable) | Évite le « on verra » | Ex. : parcours E2E, paiement, secrets hors code, staging, CGU, sandbox off |

---

## 7. Décisions actées

| Date | Décision | Par / source |
|------|----------|--------------|
| 2026-07-24 | Produit vivant = `mobile/` + `backend/` Node | FD-002 §9 |
| 2026-07-24 | Deuxième Âme v1 + Event Engine + Laboratoire **implémentés** (v0.9.3→v0.9.5.2) — hors question « à construire » | FD-004 §5, §10, §17 |
| 2026-07-24 | Opportunité Volante = couche **diffusion**, pas type d'événement | FD-004 §11 |
| 2026-07-24 | FICHE_DISCUSSION + **FD-004 lecture obligatoire** Cursor Adam | FD-004, FD-001 |
| 2026-07-24 | Bac à sable / impersonation **interdit en prod** (principe) | FD-004 §17 — formalisation ops via D13 / Phase 0 |

*(Les décisions D1–D12, D14, D16 de §6 restent **ouvertes** jusqu'à validation Reda + Adam de cette fiche.)*

---

## 8. Minimum vital proposé pour cette semaine

À valider / amender avec Reda :

1. **D1** — sort du web Next.js  
2. **D2** — intention Postgres (même si migration plus tard)  
3. **D4** — périmètre prod v1 (Première Âme obligatoire ; trancher inclusion 2e Âme v1 / Wallet / Identity)
4. **D5** — PSP  
5. **D6** — niveau stock au lancement  
6. **D10** — hébergeur / env  
7. **D14** — ordre des chantiers entre les deux postes  

---

## 9. Questions ouvertes pour le Cursor de Reda

- ~~Quels points sont déjà tranchés ?~~ → **Partiellement répondu** : voir §7 et [FD-004](./FD-004-contexte-complet-projet-adam.md) §23. Reste à **acter formellement** D1, D4 (prod v1), D5, D10, D14.
- Y a-t-il des **contraintes** (délais, partenaires commerçants, zone pilote déjà choisie, budget) qui invalident certaines propositions ?
- **D4 précis :** en prod v1, inclut-on la Deuxième Âme v1 telle qu'implémentée, ou gel feature jusqu'à stabilisation Première Âme ?
- Faut-il **fusionner** certaines décisions avec une fiche vision produit plus large (ex. modèle économique) plutôt que tout traiter ici ?
- Confirmer ou corriger l'ordre Phase 0 → métier (dispatch P1–P3 vs inventaire).

> **Docs externes obsolètes :** `PORTRAIT_MAZONE_INVENTAIRE_ROADMAP.md` §4.6 et §J (« Deuxième Âme non réalisée ») — **ne plus utiliser** ; FD-004 fait foi.

---

## 10. Étapes proposées

| # | Étape | Livrable | Statut |
|---|-------|----------|--------|
| 1 | Publier ce brouillon sur `main` pour lecture Reda | FD-003 | **fait** |
| 2 | Cursor Reda croise / amende la liste | FD-004 + amendement FD-003 | **en cours** (24/07) |
| 3 | Reda + Adam valident la liste amendée | Statut → **validé** | à faire |
| 4 | Enchaîner Phase 0 ou ADR selon D14 | Code / ADR | bloqué par étape 3 |

---

## 11. Notes pour les deux Cursor

- **Les deux Cursor :** lire **[FD-004](./FD-004-contexte-complet-projet-adam.md)** avant FD-003 — état code, organes, Deuxième Âme v1, anti-patterns.
- **Cursor Adam** : ne pas implémenter les points §6 encore ouverts (D1–D12, D14, D16) tant que le statut reste `brouillon`. **Ne pas proposer** de « commencer la Deuxième Âme » — elle existe (v0.9.3+).
- **Cursor Reda** : FD-003 liste les **décisions deploy** ; FD-004 liste **ce qui existe**. Les deux ne doivent jamais se contredire.
- Une fois validée : les décisions actées remontent en §7 (et éventuellement FD-002 §10 si elles ferment des questions ouvertes).

---

*Fiche amendée après croisement Reda / FD-004 le 24/07/2026 — statut brouillon jusqu'à validation Reda + Adam.*
