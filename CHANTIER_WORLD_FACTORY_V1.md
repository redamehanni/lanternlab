# Chantier livré — Fondations backend du Bac à Sable (World Factory)

**Date :** 15 juillet 2026
**Statut :** Livré et vérifié — premier incrément du Bac à Sable
**Références :** [PLAN_FONDEATIONS_BAC_A_SABLE.md](PLAN_FONDEATIONS_BAC_A_SABLE.md) · [ETUDE_BAC_A_SABLE_MAZONE.md](ETUDE_BAC_A_SABLE_MAZONE.md)
**Public :** Architectes Ma Zone — compte rendu d'implémentation

---

## Résumé exécutif

Les **fondations backend** du Bac à Sable sont en place : identité administrateur séparée de l'écosystème citoyen, namespace `/api/admin`, et moteur **World Factory** capable de peupler et réinitialiser un monde de démonstration via des recettes pluggables.

**Aucune UI.** Tout est testable en headless. 21 assertions vertes. Boot serveur OK. Lints propres.

**Principe architectural acté et documenté dans le code :**

> Le World Factory n'est jamais un second moteur métier. Il orchestre les organes existants. Il ne réimplémente jamais leur logique.

---

## Philosophie respectée

| Principe | Implémentation |
|----------|----------------|
| Orchestrer, ne pas réécrire | Wallet via `walletEngine.issueObject` / `consumeObject` |
| Admins hors citoyens | Table `admin_users` + JWT secret distinct |
| Provenance nettoyable | `demo_batches` + `demo_entities` |
| Open/Closed | Nouvelles recettes sans toucher au cœur |
| Évolution future ouverte | Commentaires : avancées de temps / souvenirs possibles plus tard |
| Pas de sur-ingénierie | Une recette, pas de commandes/dispatch live, pas d'UI |

---

## Architecture livrée

```
Back Office (futur)
       │
       ▼
 /api/admin/*
       │
       ▼
 lib/worldFactory/
 ├── recipeRegistry.js   ← principe fondamental documenté
 ├── context.js          ← primitives auto-taguées
 ├── index.js            ← run / reset
 └── recipes/
     └── quartierAnime.js
       │
       ├──► walletEngine (organe)
       └──► users / stores / products (primitives, taguées)
```

---

## Fichiers créés ou finalisés

| Fichier | Rôle |
|---------|------|
| `backend/src/db/index.js` | Tables `admin_users`, `demo_batches`, `demo_entities` |
| `backend/src/middleware/adminAuth.js` | `verifyAdmin`, `signAdminToken`, secret admin |
| `backend/scripts/create-admin.js` | Bootstrap premier admin (idempotent) |
| `backend/src/lib/worldFactory/recipeRegistry.js` | Registre de recettes + principe fondamental |
| `backend/src/lib/worldFactory/context.js` | `createCitizen`, `createMerchantWithStore`, `createProduct`, `addFavorite`, `issueWalletObject`, `consumeWalletObject` |
| `backend/src/lib/worldFactory/index.js` | `listRecipes`, `runRecipe`, `listBatches`, `resetBatch`, `resetAllDemo` |
| `backend/src/lib/worldFactory/recipes/quartierAnime.js` | Première recette paramétrable |
| `backend/src/routes/admin.js` | Routes HTTP admin |
| `backend/src/index.js` | Montage `app.use('/api/admin', adminRoutes)` |

---

## Modèle de données

### `admin_users`

Identité de l'équipe Ma Zone. **Jamais** dans `users` citoyens.

| Colonne | Rôle |
|---------|------|
| `id`, `email`, `password`, `name` | Authentification |
| `level` | Niveau (`operator`, `superadmin`…) |
| `active` | Soft-disable |

### `demo_batches`

Une exécution de recette (`active` ou `reverted`).

### `demo_entities`

Provenance : chaque entité créée (`user`, `store`, `product`, `favorite`, `wallet_object`) est tracée pour un reset propre, sans colonnes polluantes sur les tables métier.

---

## API admin

| Méthode | Route | Auth | Rôle |
|---------|-------|------|------|
| `POST` | `/api/admin/auth/login` | Public | Login → token admin |
| `GET` | `/api/admin/me` | Admin | Profil admin |
| `GET` | `/api/admin/world/recipes` | Admin | Liste des recettes |
| `POST` | `/api/admin/world/run` | Admin | `{ recipeId, params }` → batch |
| `GET` | `/api/admin/world/batches` | Admin | Batches existants |
| `POST` | `/api/admin/world/reset` | Admin | Reset d'un batch (ou tout le demo) |

Un **token citoyen** est rejeté (secret JWT distinct + claim `type: 'admin'`).

---

## Recette `quartier_anime`

Génère un quartier réaliste paramétrable (`residents`, `merchants`) :

- habitants (clients) ;
- commerçants + boutiques + produits ;
- favoris ;
- objets Wallet via l'organe (billets, promos, fidélité) ;
- consommation d'un billet via `consumeWalletObject` (facette souvenir).

**Sans** commandes live / dispatch (extension gardée).

---

## Utilisation immédiate

```bash
# Créer l'admin (déjà fait une fois en vérif ; idempotent)
cd backend && node scripts/create-admin.js
# Défauts : admin@mazone.local / admin1234
```

Puis :

1. `POST /api/admin/auth/login` `{ "email": "admin@mazone.local", "password": "admin1234" }`
2. `POST /api/admin/world/run`  
   `{ "recipeId": "quartier_anime", "params": { "residents": 5, "merchants": 3 } }`  
   Header : `Authorization: Bearer <token_admin>`
3. `POST /api/admin/world/reset` `{ "batchId": "..." }` (ou sans `batchId` pour tout resetter)

---

## Vérifications effectuées

| Vérification | Résultat |
|--------------|----------|
| Registre `quartier_anime` | OK |
| Token admin valide / token citoyen rejeté | OK |
| Run → résidents, commerçants, produits, Wallets | OK |
| Entités tracées dans `demo_entities` | OK |
| Wallet via `source_engine = 'world_factory'` | OK |
| Billets consommés via l'organe (souvenirs) | OK |
| Citoyen hors demo intact après run et reset | OK |
| Reset → zéro résidu demo | OK |
| Recette inconnue → 404 | OK |
| Boot serveur + `/health` | OK |
| Lints | Aucune erreur |

**21 assertions** — toutes passent. Script de vérification temporaire ensuite supprimé.

---

## Décision technique notable

`runRecipe` n'enveloppe **pas** toute la recette dans une transaction SQLite globale : les organes (Wallet) ont déjà leurs transactions, et `better-sqlite3` refuse les imbrications. En cas d'échec, un reset du batch partiel est tenté.

---

## Hors périmètre (incréments suivants)

| Élément | État |
|---------|------|
| UI Back Office web (React/Vite) | Non commencé |
| Shell Épée / Cockpit commerçant | Non commencé |
| Face Administration (gestion users, stats) | Non commencé |
| Commandes / dispatch dans les recettes | Extension gardée |
| Évolution temporelle du monde | Préparée conceptuellement, non développée |
| Intelligence Priorités / Suggestions / Santé | Pour le Cockpit, plus tard |

---

## Critère de succès — atteint

L'équipe Ma Zone peut désormais :

1. s'authentifier comme admin ;
2. lancer `quartier_anime` ;
3. obtenir une ville peuplée (citoyens, commerces, Wallets) ;
4. resetter proprement le batch ;
5. ajouter demain une nouvelle recette **sans modifier le cœur** du moteur.

C'est le terrain sur lequel les futurs organes (Event, Marketing, Collaboration…) pourront naître et être démontrés.
