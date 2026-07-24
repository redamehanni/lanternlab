# FD-001 — Chantier Fondation API compatible avec les logiciels commerciaux

| | |
|---|---|
| **Statut** | **brouillon** — en attente validation Reda / Adam |
| **Date** | 2026-07-24 |
| **Auteur(s)** | Adam (AdamY76) + Cursor Adam — destinée au Cursor Reda |
| **Phase / chantier** | Fondation API — interop logiciels commerciaux |
| **Références** | [FD-000](./FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md) · [Cartographie_Metier_V1](./Cartographie_Metier_V1.md) · [Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1](./Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md) · plan Cursor *Codage Fondation API* (non exécuté) |

> **Ne pas contredire FD-000** sans mise à jour validée de FD-000 ou fiche plus récente.  
> **Cette fiche n’est pas du code.** Elle raconte *comment on en est arrivé* au plan de codage, pour que le Cursor de Reda (et tout futur Cursor) reprenne le fil sans rejouer les conversations.

---

## 1. Contexte

Ma Zone veut devenir l’outil qui **colle aux logiciels que les commerçants utilisent déjà** (POS, e-commerce, stock…), sans les forcer à abandonner leur caisse le jour 1, et **sans** que le cœur Ma Zone dépende d’un éditeur externe (Shopify, Lightspeed, etc.).

Ce chantier a démarré après le reset FICHE_DISCUSSION du 24/07/2026 (FD-000 seule référence). Il a produit une cartographie métier, un plan de conception, puis un **plan de codage** — **le code n’a pas encore été écrit** (directive Adam : ne pas build tout de suite).

**Pourquoi cette FD-001 maintenant ?**  
Pour synchroniser le Cursor de Reda : vision, décisions, artefacts, et état exact du chantier — sans qu’il doive lire tout l’historique de chat.

---

## 2. Vision & philosophie

- **Surface compose, organe décide** (FD-000) — les routes et adapters n’implémentent pas de règles métier.
- **Logiciels externes = adapters jetables** (Anti-Corruption Layer) — le cœur ne parle jamais le dialecte Shopify/Lightspeed.
- **CDM Ma Zone = dictionnaire interne**, pas « vérité de tout le commerce ». La propriété est **par attribut** (propriétaire / miroir / calculateur).
- **OV = stratégie de diffusion**, pas un type d’événement.
- **Wallet ≠ PSP**.
- Produit officiel = `mobile/` + `backend/` Node — pas de legacy Next.js.

---

## 3. Objectif du chapitre

Faire évoluer l’API Ma Zone pour l’interopérabilité multi-logiciels :

1. Contrats API métier versionnés (`/api/v1`) alignés sur un CDM.
2. Inventory Engine (stock à **triple état**) branché sur le flux commande.
3. Integration Engine + connecteurs (au minimum un chemin manuel/CSV ; natifs plus tard).
4. Sync fiable (Inbox / Outbox, idempotence, réconciliation) sous contraintes SQLite.

---

## 4. Périmètre

### Inclus (déjà produit — docs)

- Étude POS / stock / miroir (SumUp, Qonto, Lightspeed, Clictill, L’Addition, Zettle, Shopify, Vigilantia, Chift…).
- Encyclopédie métier [`Cartographie_Metier_V1`](./Cartographie_Metier_V1.md) (+ PDF).
- Plan de conception [`Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1`](./Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md) (+ PDF) — *anciennement* `Plan_Conception_API_Compatible_V1`.
- Plan de codage Cursor (*Codage Fondation API*) : tranches A, B, C, E — **pas encore exécuté**.

### Inclus (code — à venir, pas commencé)

- Schéma `stock_levels` / `stock_movements`, miroir `products.quantity` ← `available`.
- Inventory Engine + branchement orders / dispatch / missions / products.
- Integration Engine + `connectorRegistry` + connecteur `manual`.
- Outbox / Inbox / webhooks 202 / réconciliation.
- Routes `/api/v1/*` en parallèle de `/api/*` (compatibilité mobile totale).

### Hors périmètre (explicite)

- Connecteurs natifs réels (Shopify, Zettle…) dans le premier build (tranches D/F reportées).
- Certification NF525 de Ma Zone comme caisse.
- Remplacement forcé du POS commerçant.
- GraphQL public, Kafka, microservices day-1.
- Commit / push sans demande Adam/Reda.

---

## 5. Chaîne du chapitre (où on en est)

```
1. Cartographie_Metier_V1          ← FAIT (doc métier, pas FD)
2. Plan_Conception_…_Logiciels…   ← FAIT (doc technique, pas FD) — renommé
3. FD-001 (cette fiche)           ← FAIT (brouillon) — récit pour Reda
4. Plan de codage Cursor          ← FAIT (stratégie) — NON EXÉCUTÉ
5. Code (tranches A/B/C/E)        ← À FAIRE après GO humain
6. Amendement FD-001 (résultats)  ← APRÈS le code — pas de FD-002 séparée
```

**État au 24/07/2026 soir :** étape 4 terminée côté planification ; **aucune ligne de code du chapitre n’est écrite**.

---

## 6. Comment on en est arrivé là (récit)

### 6.1 Point de départ

Après FD-000, le fil Adam a travaillé le chapitre « Fondation API » avec une posture **architecte-chercheur** : d’abord comprendre le métier du commerce, ensuite concevoir l’API — pas l’inverse.

### 6.2 Étude des logiciels / POS

Recherche multi-sources sur caisses et stocks (FR + internationaux). Constats structurants :

- Les commerçants vivent déjà dans un **écosystème multi-logiciels**.
- Un **miroir naïf** « un compteur stock partagé partout » dérive et crée des surventes.
- Les APIs POS sont hétérogènes ; une Unified API (ex. Chift) peut couvrir le long-tail **sans** devenir le cerveau Ma Zone.
- Contrainte FR : ISCA / NF525 — Ma Zone ne se prétend pas caisse fiscale dans ce chapitre.

### 6.3 Cartographie_Metier_V1 (encyclopédie, pas FD)

Document unique consolidé (verticaux retail / CHR / épicerie / services inclus). Conclusions qui **contraignent** l’API :

| Conclusion | Impact |
|------------|--------|
| Besoin avant outil | Domaines API nommés par métier, pas par marque |
| Un attribut = un propriétaire | Matrice CDM + règles de conflit |
| Stock physique ≠ disponibilité promise | Triple état obligatoire |
| Données chaudes / froides | Sync différenciée |
| Miroir naïf = drift | Journal mouvements + réservation + réconciliation |

Étiquetage des affirmations : FAIT / PRATIQUE / ÉDITEUR / HYPOTHÈSE / DÉDUCTION.

### 6.4 Plan de conception (doc technique)

Traduit la cartographie en :

- Architecture **Ports & Adapters + ACL**.
- Surfaces : **REST + OpenAPI 3.1** `/v1` ; AsyncAPI pour webhooks ; **pas** GraphQL / Kafka V1.
- **CDM + matrice propriétaire | miroir | calculateur**.
- Trois vigilances normatives :
  1. **Conflits** — pas de LWW global ; POS gagne sur `on_hand` ; Ma Zone sur `reserved` ; `available` jamais écrit.
  2. **Triple état** — `available = on_hand - reserved - safety_buffer` ; interdit `products.quantity` comme seule vérité.
  3. **SQLite** — WAL déjà actif ; exiger `busy_timeout`, 1 worker Outbox + 1 Inbox, batch, webhook → 202 rapide.
- Roadmap code par tranches A→F.
- Ancien « plan architecture interop = FD-002 » **absorbé** dans ce plan (pas de FD architecture séparée).

**Renommage (24/07/2026) :**  
`Plan_Conception_API_Compatible_V1` → **`Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1`**.

### 6.5 Plan de codage (Cursor, non exécuté)

Décisions de cadrage Adam :

| Choix | Décision |
|-------|----------|
| Périmètre 1er build | Tranches **A, B, C, E** (pas D/F Shopify réel) |
| Compatibilité | **Miroir total** : `products.quantity` = projection de `available` ; `/api/*` inchangé ; `/api/v1` en parallèle ; **mobile non modifié** |
| Pattern registres | Copier `eventRegistry` → `connectorRegistry` + `movementRegistry` |
| Migrations | `CREATE TABLE IF NOT EXISTS` + `addColumnIfMissing` (style existant `db/index.js`) |

Ancrage code actuel (à connaître avant de coder) :

- Stock = `products.quantity` décrémenté à la commande dans [`backend/src/routes/orders.js`](../backend/src/routes/orders.js), restauré à l’annulation dans [`backend/src/lib/dispatch.js`](../backend/src/lib/dispatch.js).
- Pas de `/api/v1`, pas d’outbox, pas de webhooks, pas de tests unitaires formels (scripts headless `backend/scripts/test-*.js`).
- Socket `product:stock_updated` avec champ `quantity`.

---

## 7. Principes directeurs (ne pas dévier)

1. Aucun `require('shopify')` (ou SDK POS) dans les organes Orders / Inventory — seulement via adapter.
2. Aucun `UPDATE products SET quantity` hors du module miroir de l’Inventory Engine.
3. `available` = calcul ; jamais vérité écrasable.
4. Webhook : persist Inbox + **202** ; métier async.
5. Un seul worker Outbox + un seul worker Inbox (pas N writers parallèles SQLite).
6. Ne pas créer de FD-002 « architecture » — amender **cette** FD-001 après le code.
7. Ne pas committer sans demande explicite.

---

## 8. Étapes & statut

| # | Étape | Livrable | Statut |
|---|-------|----------|--------|
| 1 | Étude POS / interop | Notes + canvas stratégie | **Fait** |
| 2 | Cartographie métier | `Cartographie_Metier_V1.md` + PDF | **Fait** |
| 3 | Plan de conception | `Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md` + PDF | **Fait** |
| 4 | FD récit chantier | Cette FD-001 | **Brouillon** |
| 5 | Plan de codage | Plan Cursor *Codage Fondation API* | **Fait** (non exécuté) |
| 6 | Code A/B/C/E | Inventory + Integration + Sync + `/api/v1` | **À faire** (GO requis) |
| 7 | Amendement FD-001 | Résultats / écarts | **Après code** |

---

## 9. Décisions actées

| Date | Décision | Par |
|------|----------|-----|
| 2026-07-24 | Reset FICHE_DISCUSSION ; FD-000 seule référence globale | Reda / Adam |
| 2026-07-24 | Chapitre = cartographie → conception → code → mémoire FD | Adam |
| 2026-07-24 | Cartographie = doc métier (pas FD) | Adam |
| 2026-07-24 | Plan conception = doc technique (pas FD) ; absorbe l’ex-« FD architecture » | Adam |
| 2026-07-24 | Stack V1 : REST OpenAPI `/v1`, ACL, CDM nuancé, Outbox/Inbox, hybride natifs+Chift ; pas GraphQL/Kafka | Adam |
| 2026-07-24 | Triple état + matrice conflits + contraintes SQLite = normatifs | Adam |
| 2026-07-24 | 1er build code = A+B+C+E ; compat miroir `quantity` ; mobile inchangé | Adam |
| 2026-07-24 | Renommage plan → `…_Logiciels_Commerciaux_V1` | Adam |
| 2026-07-24 | FD-001 = récit pour Cursor Reda ; code **pas** démarré tout de suite | Adam |

---

## 10. Questions ouvertes

- Validation Reda de cette FD-001 et du plan de conception avant GO code ?
- Ordre exact des connecteurs natifs après le connecteur `manual` (Shopify d’abord ?) — tranche D/F.
- Seuil `SQLITE_BUSY` qui déclenche la discussion Postgres (hors chapitre immédiat).
- Extension CHR / services au-delà des limites V1 documentées.

---

## 11. Notes pour les deux Cursor

### Cursor Reda — lire en priorité

1. Cette **FD-001** (contexte + décisions).
2. FD-000 si doute sur philosophie produit.
3. [`Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md`](./Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md) pour le détail technique normatif.
4. [`Cartographie_Metier_V1.md`](./Cartographie_Metier_V1.md) si besoin du « pourquoi métier ».
5. Le plan Cursor *Codage Fondation API* pour l’implémentation — **uniquement après GO Adam/Reda**.

### Ce qu’il ne faut PAS faire

- Relancer une « FD-002 architecture interop » séparée.
- Modifier `mobile/` dans le 1er build (compat miroir).
- Traiter `products.quantity` comme vérité métier à faire évoluer côté client.
- Implémenter Shopify/OAuth avant que les tranches A/B/C/E soient solides.
- Committer ou pousser sans demande.

### Artefacts utiles (chemins)

| Artefact | Chemin |
|----------|--------|
| Cartographie | `FICHE_DISCUSSION/Cartographie_Metier_V1.md` |
| Plan conception | `FICHE_DISCUSSION/Plan_Conception_API_Compatible_Logiciels_Commerciaux_V1.md` |
| Cette fiche | `FICHE_DISCUSSION/FD-001-chantier-fondation-api-logiciels-commerciaux.md` |
| DB / stock actuel | `backend/src/db/index.js`, `backend/src/routes/orders.js` |
| Pattern registre | `backend/src/lib/eventEngine/eventRegistry.js` |
| Plans relecture obsolètes (ne pas traiter comme FD) | `FICHE_DISCUSSION/PLAN-FD-001-*`, `PLAN-FD-002-*`, `PLAN-architecture-*` |

### Après le code

Mettre à jour **cette même FD-001** (sections 5, 8, 9 + nouvelle section « Résultats ») — ne pas créer une nouvelle FD pour raconter le même chapitre.

---

*Fiche générée depuis `_TEMPLATE.md` — valider avant commit.*
