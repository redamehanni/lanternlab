# Roadmap Ma Zone — Produit déployable & adoption commerçants sans friction de compatibilité

| | |
|---|---|
| **Nature** | Roadmap produit / stratégique (document de cadrage) |
| **Date** | 2026-07-24 |
| **Auteur** | Reda Mehanni (synthèse Cursor Reda) |
| **Références** | FD-000 · FD-001 · Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1 (amendé) · Horizon A déployable |
| **Statut** | Document de travail — vision d’arrivée « aucun commerçant exclu pour cause de logiciel » |

---

## 1. Pourquoi cette roadmap existe

Ma Zone vise un stade où **chaque commerçant** qui entend parler du produit peut décider de l’adopter **sans se demander** :

> « Est-ce que ça marchera avec mes logiciels ? »

Ce document décrit le chemin complet, phase par phase, pour y arriver — en partant de l’état actuel (prototype riche, pas encore production-ready) et en enchaînant :

1. le **socle déployable** (paiement, hébergement, fiabilité commande/livraison) ;
2. la **Fondation API / Inventory** (plan actuel A+B+C+E) ;
3. les **connecteurs** mass market puis long-tail ;
4. la **profondeur métier** (push POS, CHR, services, scale).

Il ne remplace ni FD-000 (contexte global) ni le plan technique Fondation API. Il **orchestre** ces documents vers un objectif commercial clair.

---

## 2. Objectif d’arrivée — définition opérationnelle

### 2.1 Ce que « compatible pour le plus grand nombre » veut dire

| Illusion | Réalité opérationnelle |
|----------|------------------------|
| Brancher 50 POS natifs avant le lancement | Impossible et inutile |
| Un seul hub (Chift) suffit à tout | Couvre beaucoup, pas tout ; profondeur variable |
| Excel / pas de caisse = hors cible | Au contraire : **premier marché** via autonomie Ma Zone |
| Compatibilité = connexion API obligatoire | Compatibilité = **adoption sans doute** |

**Définition retenue :**

Un commerçant est « compatible » dès qu’il peut :

- **soit** brancher son logiciel (POS / e-commerce / hub) ;
- **soit** gérer son stock **dans Ma Zone** dès le jour 1 (Épée / CSV / saisie) ;
- **jamais** entendre : « Reviens quand on aura ton logiciel. »

### 2.2 Phrase commerciale cible

> « Compatible avec votre caisse si elle a une API ou est couverte par notre hub ; sinon Ma Zone fonctionne en autonomie dès le jour 1. »

C’est cette phrase — pas « 200 connecteurs natifs » — qui enlève l’hésitation.

### 2.3 Deux chemins d’adoption (toujours ouverts)

| Chemin | Pour qui | Promesse |
|--------|----------|----------|
| **A — Ma Zone gère le stock** | Pas de POS API, Excel, caisse fermée, refus d’intégrer au début | Saisie Épée / CSV / scan — opérationnel immédiatement |
| **B — Ma Zone miroir du POS** | Shopify, Zettle, Lightspeed, hub Chift, etc. | Connexion OAuth → catalogue / stock synchronisés |

Dès qu’un commerçant tombe dans **A ou B** sans friction, la question de compatibilité disparaît pour lui.

---

## 3. État de départ (aujourd’hui)

Référence : Ma Zone ~v0.9.5.2 · FD-000.

| Domaine | État |
|---------|------|
| Produit vivant | `mobile/` + `backend/` Node · SQLite |
| Marketplace Première Âme | Fonctionnelle (labo) |
| Deuxième Âme / Event Engine | Implémentés (v1) |
| Stock | Compteur `products.quantity` — fragile (survente, pas de réservation) |
| Connecteurs POS | **Aucun** |
| Paiement réel (PSP) | **Absent** |
| Hébergement prod / stores | **Absent** |
| Sécurité Phase 0 | Secrets fallback, CORS ouvert, sandbox à verrouiller |

**Conclusion :** on a une architecture et une vision solides ; on n’a pas encore un produit **déployable chez le plus grand nombre**.

---

## 4. Vue d’ensemble des phases

```
Phase 0 ───── Déployable (paiement, HTTPS, dispatch, stores, confiance)
    │
Phase 1 ───── Fondation stock A–E : triple état + chemin universel (manuel)
    │         → TOUT commerçant peut démarrer (chemin A)
    │
Phase 2 ───── Connecteurs masse : Shopify → Zettle → Lightspeed → Chift
    │         → majorité des stacks « modernes » (chemin B)
    │
Phase 3 ───── Couverture « je n’ai plus à me poser la question »
    │         → long-tail + onboarding sans cul-de-sac
    │
Phase 4 ───── Profondeur (push POS, CHR, services, Postgres…)
              → rétention / professionnalisation
```

**Règles de chevauchement :**

- Phases **0** et **1** peuvent avancer **en parallèle**.
- Phase **2** (Shopify / webhooks) exige Phase 1 **A–E done** + **Phase 0 minimum** (secrets, sandbox).
- Phases **2–3** transforment « belle archi » en « le marché nous croit ».
- Phase **4** vient **après** un volume d’adoption réel.

---

## 5. Phase 0 — Socle déployable

### 5.1 Intention

Sans cette phase, même avec tous les connecteurs du monde, Ma Zone reste un **labo local**. Phase 0 ouvre la porte : *« on peut ouvrir un pilote fermé / une vraie zone. »*

### 5.2 Pourquoi c’est prioritaire

Un commerçant n’adopte pas un outil qui :

- n’encaise pas vraiment ;
- plante sur une commande / un livreur ;
- n’a pas d’URL HTTPS stable ;
- laisse le bac à sable ouvert en production.

La compatibilité logicielle **ne sert à rien** si la confiance produit est absente.

### 5.3 Livrables concrets

#### A. Sécurité & ops (Phase 0 technique FD-000)

| Livrable | Détail |
|----------|--------|
| Secrets | `JWT_SECRET` / `ADMIN_JWT_SECRET` obligatoires — crash au boot si absents |
| CORS | Allowlist (plus de `*`) |
| Sandbox | `SANDBOX_MODE=off` en prod ; impersonation / World Factory **interdits** hors staging |
| Rate limit / helmet | Auth et routes sensibles |
| Logs / monitoring | Erreurs API, dispatch, sockets |
| Env | Séparation claire `dev` / `staging` / `prod` |

#### B. Fiabilité métier Première Âme

| Livrable | Détail |
|----------|--------|
| Dispatch P1–P3 | Missions fantômes, socket perdu, tiroir livreur — plan stabilisation existant |
| Parcours E2E | Commande → attribution → livraison → livré (cas limites documentés) |
| Stock | Au minimum : ne pas promettre n’importe quoi ; idéalement déjà branché Phase 1 |

#### C. Business & confiance

| Livrable | Détail |
|----------|--------|
| PSP | Stripe (ou équivalent acté) — paiement commande, webhooks, remboursements |
| Mentions légales | CGU, confidentialité **dans l’app** |
| Support / litiges | Process + outil minimum (qui traite, en combien de temps) |
| Commission / modèle V0 | Même court — cadre wallet / reçus / litiges |

#### D. Distribution

| Livrable | Détail |
|----------|--------|
| Backend hébergé | HTTPS + WSS |
| iOS App Store | Priorité selon capacité |
| Android Play Store | Dès que possible après iOS, ou en parallèle si capacité |
| Config prod | `EXPO_PUBLIC_API_URL`, sockets WSS |

### 5.4 Critère de sortie Phase 0

- Un **pilote fermé** (quartier / commerçants invités) peut tourner sur staging ou prod soft.
- Paiement réel testé bout-en-bout.
- Sandbox labo **impossible** à activer par erreur en prod.
- Dispatch ne bloque plus silencieusement les commandes dans les scénarios connus.

### 5.5 Porte ouverte

> « On peut déployer. »

---

## 6. Phase 1 — Fondation stock & API (tranches A + B + C + E)

### 6.1 Intention

Exécuter le **Plan Fondation API amendé** : rendre le stock **fiable** et offrir un chemin d’adoption **universel** (manuel), sans encore brancher Shopify.

C’est le chantier **Horizon A** anti-survente — pas un « enrichissement shiny ».

### 6.2 Ce qui change dans le produit

| Avant | Après Phase 1 |
|-------|----------------|
| Un compteur `products.quantity` | Triple état : `on_hand` / `reserved` / `available` |
| Décrément direct à la commande | `reserve` → commande → `commit` / `release` |
| Pas d’API versionnée métier | `/api/v1` en parallèle de `/api/*` |
| Pas d’intégrations | Integration Engine + connecteur **manual** (Épée / CSV) |
| Pas de file sync | Inbox / Outbox, idempotence, journal de conflits |
| Mobile | **Inchangé** pendant A–E (lit encore `quantity` = miroir de `available`) |

### 6.3 Modes magasin (normatifs)

| Mode | Qui écrit `on_hand` | À la livraison MZ |
|------|---------------------|-------------------|
| `inventory_owner = mazone` (**défaut**) | Inventory Engine (Épée / CSV) | Baisse `on_hand` + `reserved` |
| `inventory_owner = pos` (plus tard, Phase 2+) | Adapter POS | Baisse **seulement** `reserved` — évite double décrément |

### 6.4 Tranches de code (rappel)

| Tranche | Contenu | Dans le 1er build ? |
|---------|---------|---------------------|
| **A** | Contrats OpenAPI `/v1`, squelette tables | Oui |
| **B** | Inventory Engine + branchement commandes | Oui |
| **C** | Integration Engine + connecteur manual / CSV | Oui |
| **E** | Outbox / Inbox / réconciliation / busy_timeout | Oui |
| **D** | Shopify natif | **Non** — Phase 2 |
| **F** | Zettle / Lightspeed / Chift / push | **Non** — Phases 2–4 |

### 6.5 Ce que Phase 1 débloque déjà pour les commerçants

- **100 % des commerçants** peuvent démarrer **sans** logiciel tiers.
- Anti-survente sur le canal Ma Zone.
- Base pour brancher un POS plus tard **sans refactor** Orders.
- OV / marketplace peuvent s’appuyer sur `available` (promesses honnêtes).

### 6.6 Critère de sortie Phase 1

- Plus aucun `UPDATE products SET quantity` hors module miroir Inventory.
- Magasin sans POS : stock géré via Épée / CSV, commandes réservent correctement.
- Scénarios oversell / annulation / livraison validés manuellement (ou tests headless).
- FD-001 amendée avec les résultats (écarts plan vs réel).

### 6.7 Porte ouverte

> « Tout commerçant peut adopter Ma Zone dès demain — en autonomie. »

C’est déjà la réponse à la compatibilité pour ceux qui n’ont rien, ou qui refusent de brancher leur caisse au jour 1.

---

## 7. Phase 2 — « Connecte ta caisse » — masse critique

### 7.1 Intention

Couvrir les stacks **les plus fréquents** chez les TPE / PME locales, pour que le chemin B soit réel — pas seulement documenté.

### 7.2 Prérequis (normatifs)

- Phase 1 **A–E done**.
- Phase 0 **minimum** : secrets hors code, sandbox verrouillable, HTTPS pour webhooks.
- GO explicite Reda + Adam avant chaque connecteur natif.

### 7.3 Ordre de couverture recommandé

| Ordre | Connecteur | Pourquoi | Capacité V1 typique |
|-------|------------|----------|---------------------|
| 1 | **Shopify** | Très présent retail / click & collect | Lecture catalogue + inventaire, webhooks → `on_hand` |
| 2 | **Zettle** | Très présent petits commerces FR | Miroir mouvements stock |
| 3 | **Lightspeed** (X-Series) | Retail / CHR mid | Outlets / inventory API |
| 4 | **Chift** | Un adapter → long-tail FR | Couverture large, profondeur selon l’éditeur derrière Chift |

Chaque connecteur = **un adapter** dans `connectorRegistry` (Open/Closed) — jamais un SDK Shopify dans `orders.js`.

### 7.4 UX Épée obligatoire — « Mes intégrations »

Écran commerçant avec, pour chaque magasin :

| État | Message / action |
|------|------------------|
| Non connecté | « Gérer le stock dans Ma Zone » (chemin A) **ou** « Connecter mon logiciel » |
| Connecté | Nom du connecteur, dernier sync, conflits éventuels |
| Logiciel inconnu | « Continuer avec Ma Zone » + « Demander mon logiciel » (file produit) |

**Règle d’or UX :** jamais un cul-de-sac « logiciel non supporté » sans alternative A.

### 7.5 Comportement stock en mode POS

1. Le POS (ou Shopify) est maître de `on_hand`.
2. Ma Zone réserve (`reserved`) à la commande.
3. À la livraison MZ : on libère / commit **sans** re-décrémenter `on_hand` si le POS le fera (ou l’a déjà fait).
4. Push vente MZ → POS = **option Phase 4**, pas bloquant Phase 2.

### 7.6 Critère de sortie Phase 2

- Au moins **Shopify** live en lecture (miroir inventaire) sur staging puis prod pilote.
- Idéalement Zettle **ou** Lightspeed + **Chift** démarré.
- Onboarding commerçant : choix A/B en moins de 5 minutes.
- Zéro double décrément constaté sur scénarios de test.

### 7.7 Porte ouverte

> « La majorité des commerçants “modernes” se connectent en un clic ; les autres restent sur le chemin A. »

---

## 8. Phase 3 — Couverture « je n’ai plus à me poser la question »

### 8.1 Intention

Atteindre le **ressenti universel** : quel que soit le commerçant, l’onboarding a une réponse.

### 8.2 Leviers

#### 1. Maximiser Chift

Tout ce que Chift couvre devient « compatible via hub » — même si la profondeur (webhooks temps réel, push) varie selon l’éditeur.

#### 2. Natifs FR ciblés

Là où Chift est faible ou un partenariat API existe :

| Cible | Vertical typique | Note |
|-------|------------------|------|
| **Clictill** | Épicerie / retail FR | Selon accès API |
| **L’Addition** | CHR | Partiel Inventory ; tables / KDS = Phase 4 |
| **SumUp** / **Square** | Petits commerces | Natif ou via hub si couvert |

#### 3. Onboarding magique

Parcours type :

1. « Quel logiciel utilises-tu ? » (liste + recherche)
2. Si **connu + connecteur** → bouton **Connecter**
3. Si **inconnu / pas d’API** → **Continuer avec Ma Zone** (CSV / saisie) + option **Demander mon logiciel**
4. File d’attente produit : volume de demandes = priorité des prochains adapters

#### 4. Filet de sécurité permanent

Le chemin A (autonomie Ma Zone) reste **toujours** excellent : UX stock Épée, alertes rupture, import CSV, éventuellement scan code-barres (niveau autonomie 1).

### 8.3 Ce qu’on peut dire commercialement (et ce qu’on ne dit pas)

| On dit | On ne dit pas |
|--------|----------------|
| Compatible avec les principales caisses / Shopify / hub | Compatible avec absolument tous les logiciels natifs |
| Sinon, opérationnel en autonomie jour 1 | Vous devez attendre notre connecteur |
| Demandez votre logiciel — on priorise | On ne supportera jamais X |

### 8.4 Critère de sortie Phase 3

- Onboarding **ne bloque jamais** un commerçant.
- Top stacks (Shopify, Zettle, Lightspeed) + hub Chift en production.
- Au moins 1–2 natifs FR (Clictill et/ou SumUp/L’Addition) en cours ou live.
- Phrase commerciale cible utilisable sans astérisque trompeur.
- Métrique interne : % d’onboardings qui terminent sans ticket « incompatibilité ».

### 8.5 Porte ouverte

> « Aucun commerçant n’est exclu pour raison de compatibilité logicielle. »

---

## 9. Phase 4 — Profondeur métier & scale

### 9.1 Intention

Après l’adoption : réduire la double saisie, couvrir les verticaux hors SKU simple, industrialiser.

### 9.2 Chantiers typiques

| Chantier | Valeur | Complexité |
|----------|--------|------------|
| **Push vente MZ → POS** | Une commande Ma Zone apparaît dans la caisse | Moyenne — tranche F du plan |
| **Prix / catalogue bi-directionnels** | Selon matrice propriétaire / miroir CDM | Moyenne |
| **CHR** (tables, KDS, L’Addition / Lightspeed K) | Resto = pas seulement stock SKU | Haute — autre modèle d’offre |
| **Services** (Planity, agendas) | Capacité / créneaux ≠ `on_hand` | Haute — organe capacité |
| **Multi-magasins / multi-outlet** | Chaînes locales | Moyenne |
| **Postgres** | Concurrence, backups, scale | Moyenne — déclenché par seuil `SQLITE_BUSY` / volume |
| **Scan / CSV / alertes** (niveau stock 1+) | Autonomie commerçant sans POS | Faible à moyenne |

### 9.3 Porte ouverte

> « Ma Zone n’est plus seulement un canal de livraison : c’est un miroir opérationnel du commerce. »

---

## 10. Matrice logiciels — où on en sera à chaque phase

### 10.1 Après Phase 1 seulement

| Logiciel / chemin | Compatible ? | Comment |
|-------------------|--------------|---------|
| Saisie Épée / CSV | **Oui** | Chemin A |
| Shopify, Zettle, Lightspeed, Chift, Clictill… | **Non encore** | Architecture prête, adapter absent |

### 10.2 Après Phase 2 (cible)

| Logiciel | Statut cible |
|----------|--------------|
| Épée / CSV | Oui |
| Shopify | Oui (lecture inventaire) |
| Zettle | Oui ou en cours |
| Lightspeed | Oui ou en cours |
| Chift (hub) | Démarré / partiel |

### 10.3 Après Phase 3 (cible « sans question »)

| Famille | Statut cible |
|---------|--------------|
| Chemin A | Excellent, toujours disponible |
| Top natifs + Chift | Production |
| Natifs FR prioritaires | Au moins partiels |
| Logiciel inconnu | Jamais bloqué — autonomie + demande |

### 10.4 Hors Inventory / hors promesse Phase 1–3

| Famille | Pourquoi |
|---------|----------|
| Planity / Square Appointments | Agenda ≠ stock SKU |
| Deliveroo / Uber Eats / Just Eat | Canaux commande — autre chantier |
| Comptabilité Sage / NF525 « être la caisse » | Ma Zone ne remplace pas la caisse fiscale |
| Toast / Odoo / Prestashop… | Via Chift si couvert, sinon file d’attente |

---

## 11. Ce qui manque pour chaque logiciel « pas encore »

Pour **chaque** connecteur non livré, le même kit :

1. **Adapter** (`toCanonical` / `fromCanonical`, auth, pull, webhooks)
2. **Credentials** (OAuth app, clés API, compte hub)
3. **Mapping** outlet POS ↔ `store` Ma Zone (`ExternalBinding`)
4. **Mode** `inventory_owner = pos` + anti double-décrément
5. **Phase 0** (secrets, HTTPS, sandbox) avant webhooks publics
6. Optionnel : **push** vente MZ → POS

Pour **Chift** : compte / contrat + un adapter `chift` unique.  
Pour **CHR / services** : pas seulement un adapter stock — un **modèle d’offre** adapté (table, créneau).

---

## 12. Organisation duo Reda ↔ Adam (suggestion)

| Phase | Focus typique | Prérequis docs |
|-------|---------------|----------------|
| 0 | Sécurité, PSP, hébergement, dispatch | FD-000 Horizon A |
| 1 | Inventory + manual (A–E) | FD-001 + Plan conception amendé |
| 2 | Shopify puis Zettle / Lightspeed / Chift | GO après A–E + Phase 0 min |
| 3 | Onboarding + long-tail + natifs FR | Métriques demandes « mon logiciel » |
| 4 | Push / CHR / services / Postgres | Après volume réel |

Règle Cursor : **git pull** · lire FD-000 · FD-001 si stock/API · ne pas démarrer D avant A–E + Phase 0 min.

---

## 13. Risques et garde-fous

| Risque | Mitigation |
|--------|------------|
| Lancer les connecteurs avant le stock triple état | Phase 1 avant Phase 2 |
| Webhooks en prod sans secrets | Phase 0 min avant D |
| Promettre « tous les logiciels » | Phrase commerciale §2.2 |
| Double décrément MZ + POS | Modes `mazone` / `pos` |
| Double vérité `quantity` | Migration T0–T3 normative |
| Négliger le chemin A | UX Épée / CSV = produit à part entière |
| Refactor mobile trop tôt | Mobile inchangé pendant A–E |
| SQLite saturé | Seuil busy → discussion Postgres (Phase 4) |

---

## 14. Synthèse exécutive

| Question | Réponse |
|----------|---------|
| Par où commencer ? | Phase 0 (déployable) **en parallèle** de Phase 1 (stock A–E) |
| Quand le 1er commerçant peut adopter sans POS ? | Fin de Phase 1 |
| Quand la majorité des stacks modernes se connectent ? | Fin de Phase 2 |
| Quand plus personne n’est exclu pour compatibilité ? | Fin de Phase 3 (avec chemin A excellent) |
| Faut-il 50 connecteurs natifs ? | **Non** — A universel + top natifs + Chift + onboarding sans cul-de-sac |
| Le plan Fondation API actuel ? | C’est **exactement** la Phase 1 |

---

## 15. Prochaine action concrète

1. Valider cette roadmap avec Adam (alignement vision).  
2. Valider / amender FD-001 + plan conception (déjà amendés Reda — GO Adam).  
3. Décider le **parallèle** Phase 0 vs Phase 1 (qui fait quoi sur les deux Cursor).  
4. **Ne pas** démarrer Shopify (D) avant A–E + Phase 0 min.  
5. Après Phase 1 code : amender FD-001 (résultats), pas créer une fiche architecture séparée.

---

*Roadmap Adoption Commerçants & Compatibilité — Ma Zone — 2026-07-24*  
*Document explicatif phase par phase — complémentaire de FD-000 / FD-001 / Plan Fondation API.*
