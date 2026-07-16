# Plan — Laboratoire Vivant · Back Office (Phase 2 du Bac à Sable)

**Date :** 16 juillet 2026  
**Statut :** Plan à valider — aucune implémentation exécutée  
**Références :** [PLAN_FONDEATIONS_BAC_A_SABLE.md](PLAN_FONDEATIONS_BAC_A_SABLE.md) · [CHANTIER_WORLD_FACTORY_V1.md](CHANTIER_WORLD_FACTORY_V1.md) · [CHANTIER_EPEE_SHELL_V1.md](CHANTIER_EPEE_SHELL_V1.md)  
**Public :** Architectes Ma Zone — plan d'implémentation

---

## Document de référence

| Format | Fichier | Usage |
|--------|---------|-------|
| **HTML** | `PLAN_LABORATOIRE_VIVANT.md` → `.html` | Lecture dans Cursor / navigateur |
| **Markdown** | `PLAN_LABORATOIRE_VIVANT.md` | Partage / édition |
| **PDF** | `PLAN_LABORATOIRE_VIVANT.pdf` | Impression / revue externe |

---

## Vision

Le Back Office n'est **pas** un outil d'administration classique, ni un éditeur de données. C'est un **laboratoire habité** :

- générer un monde à partir d'une recette World Factory ;
- explorer librement habitants, commerçants, livreurs, Wallets, commandes, identités ;
- sélectionner n'importe quel acteur **démo** ;
- **prendre temporairement son rôle** — ouvrir la *vraie* application Ma Zone telle que cet acteur la voit (citoyen, Cockpit commerçant, ou livreur).

Ainsi, chaque scénario testé emprunte exactement les mêmes chemins que les utilisateurs réels.

---

## Principe intangible

Deux règles non négociables :

1. **Entrer dans un acteur = s'authentifier, pas muter.**  
   « Devenir X » émet un vrai jeton citoyen pour un utilisateur **démo** et ouvre sa vraie app Ma Zone (web) dans un **nouvel onglet**. Aucune donnée n'est modifiée par le seul fait d'entrer.

2. **Le labo n'écrit jamais en base directement.**  
   Toute action (créditer un Wallet, plus tard inscrire à un événement…) passe par l'organe concerné (`walletEngine`, etc.). Là où l'organe n'existe pas encore, l'action n'est simplement pas offerte.

---

## Architecture cible

```
┌─────────────────────────────────────────────────────────────┐
│  admin-web (React + Vite) · :5174                           │
│  Login → Console World Factory → Explorateur d'acteurs      │
│           │                         │                       │
│           │                         ├─ « Devenir X »        │
│           │                         └─ Pouvoirs du labo     │
└───────────┼─────────────────────────┼───────────────────────┘
            │                         │
            ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/admin · verifyAdmin · sandbox-only                    │
│                                                             │
│  POST /impersonate (démo-only) ──► jeton user (0 écriture)  │
│  POST /lab/actions/:id ──────────► organes (Wallet…)        │
│  world/run · batches · reset ────► World Factory            │
│  GET /world/actors ──────────────► lecture seule            │
└─────────────────────────┬───────────────────────────────────┘
                          │ nouvel onglet #labToken=…
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Vraie app Ma Zone web · :8081                              │
│  loginUser(token) → Client / Cockpit / Livreur              │
│  Actions normales → Orders, Wallet, Dispatch, Comm, Identity│
└─────────────────────────────────────────────────────────────┘
```

---

## Socle confirmé (aucune surprise)

| Élément | État |
|---------|------|
| Jeton citoyen `jwt.sign({ id, name, email, role }, JWT_SECRET)` | [backend/src/routes/auth.js](backend/src/routes/auth.js) — l'impersonation le reproduit |
| `GET /api/users/me` | [backend/src/routes/users.js](backend/src/routes/users.js) |
| App mobile **web-ready** | `react-native-web`, `expo start --web`, carte `.web.js`, QR SVG |
| Session **par onglet** sur le web | [mobile/src/utils/storage.js](mobile/src/utils/storage.js) → plusieurs acteurs cohabitent |
| API admin World Factory | Déjà livrée (Phase 0) : login, recipes, run, batches, reset |
| Shell Épée | Déjà livrée (Phase 1) — le commerçant imité voit le Cockpit |

---

## Partie A — Backend (mince, admin-gated, sandbox-only)

Tout est ajouté sous `/api/admin` (middleware `verifyAdmin` déjà en place).

### A1. Garde sandbox

Nouveau `backend/src/lib/sandbox.js` :

```
isSandbox() = SANDBOX_MODE === 'on' || NODE_ENV !== 'production'
```

Les endpoints impersonation + lab refusent **403** hors sandbox.

### A2. Exploration (lecture seule)

`backend/src/lib/worldFactory/explorer.js` :

| Fonction | Rôle |
|----------|------|
| `listActors({ type, batchId })` | Jointure `demo_entities` (type `user`) × `users`, filtrable par rôle et batch |
| `getActorDetail(userId)` | Profil + selon rôle : store/produits, commandes, objets Wallet, Identity, favoris, conversations |

**Uniquement des SELECT.** Aucune mutation.

Routes :

- `GET /api/admin/world/actors`
- `GET /api/admin/world/actors/:id`

### A3. Impersonation — clé de voûte

`POST /api/admin/impersonate { userId }` dans [backend/src/routes/admin.js](backend/src/routes/admin.js) :

1. refuse si non-sandbox ;
2. refuse si `userId` **absent de `demo_entities`** (type `user`) → on ne peut **jamais** devenir un vrai citoyen ;
3. émet `jwt.sign({ id, name, email, role }, JWT_SECRET, { expiresIn: '12h' })` ;
4. renvoie `{ token, user }`.

**Aucune écriture en base.**

### A4. Pouvoirs du labo — registre d'actions via organes

Même patron Open/Closed que les recettes World Factory :

```
backend/src/lib/lab/
├── actionRegistry.js
└── actions/
    └── wallet.js
```

| Action | Organe appelé |
|--------|---------------|
| `issue_wallet_object` | `walletEngine.issueObject({ …, sourceEngine: 'lab' })` |
| `consume_wallet_object` | `walletEngine.consumeObject(…)` |

Routes :

- `GET /api/admin/lab/actions`
- `POST /api/admin/lab/actions/:actionId { targetUserId, params }`

Garde : sandbox + cible **démo-only**.  
Extensible : un futur organe = un fichier d'action, sans toucher au cœur.

### A5. Reset par appartenance (durcissement)

**Problème :** le reset actuel ne supprime que les entités tracées dans `demo_entities`. L'impersonation crée des lignes réelles (commandes, objets Wallet…) **non tracées**, donc non nettoyées.

**Solution :** `backend/src/lib/worldFactory/demoWorld.js` → `purgeUsers(userIds)` :

- garde : uniquement des users présents dans `demo_entities` ;
- suppression de la **clôture d'appartenance** en ordre FK-safe :

```
digital_object_events → digital_objects
identity_events → identity_presentations
conversation_reads → messages → conversations
support_messages → support_threads
missions → orders
cart_items, store_favorites, promotions, store_members
client_addresses, driver_notifications, merchant_notifications
products → stores → users
```

`resetBatch` / `resetAllDemo` de [backend/src/lib/worldFactory/index.js](backend/src/lib/worldFactory/index.js) délèguent à cette purge. Les batches restent tracés pour inspection (`status: reverted`).

---

## Partie B — Mobile : passage de jeton (changement minimal)

**Un seul fichier modifié :** [mobile/src/context/AppContext.js](mobile/src/context/AppContext.js).

Au boot, **web uniquement** :

1. lire `window.location.hash` pour `labToken` ;
2. si présent → `GET /api/users/me` avec ce jeton ;
3. `loginUser(user, token)` ;
4. nettoyer le hash.

La session par onglet fait le reste : l'onglet devient cet acteur et atterrit dans la bonne app (client / Cockpit / livreur) via `AppNavigator`.

**Aucune autre modification de l'app.**

---

## Partie C — Back Office web `admin-web/` (React + Vite)

Nouvelle app autonome (n'impacte ni `backend/` ni `mobile/`).

```
admin-web/
├── package.json            (react, react-dom, vite)
├── vite.config.js          (port 5174)
├── index.html
└── src/
    ├── main.jsx, App.jsx
    ├── config.js           (API_URL=:4000, MOBILE_WEB_URL=:8081)
    ├── api.js              (fetch + jeton admin localStorage)
    ├── pages/LoginPage.jsx
    ├── pages/WorldPage.jsx      (recettes, run+params, batches, reset)
    └── pages/ExplorerPage.jsx   (acteurs, détail, Devenir X, pouvoirs)
```

### Console World Factory

| Action UI | API |
|-----------|-----|
| Lister recettes | `GET /world/recipes` |
| Lancer (avec params) | `POST /world/run` |
| Voir batches | `GET /world/batches` |
| Reset batch / tout | `POST /world/reset` |

### Explorateur

- Liste des acteurs démo filtrable par rôle / batch.
- Fiche détail (lecture seule).
- Bouton **Devenir X** → `POST /impersonate` →  
  `window.open(\`${MOBILE_WEB_URL}/#labToken=${token}\`, '_blank')`.
- Formulaire **Pouvoirs du labo** piloté par `GET /lab/actions`.

CORS `*` déjà actif → appels directs à `:4000`, pas de proxy.

---

## UX d'entrée : nouvel onglet

Choix acté : **un nouvel onglet navigateur par acteur**.

Avantages :

- exploite directement l'isolation `sessionStorage` (1 session / onglet) déjà en place ;
- un habitant, un commerçant et un livreur peuvent cohabiter simultanément ;
- parcours multi-acteurs en temps réel (commande → offre livreur → Cockpit) testables côte à côte.

---

## Lancement (dev)

| Processus | Commande | Port |
|-----------|----------|------|
| Backend | `cd backend && npm run dev` | 4000 |
| App Ma Zone web | `cd mobile && npm run web` | 8081 |
| Back Office | `cd admin-web && npm run dev` | 5174 |

Admin bootstrap : `node backend/scripts/create-admin.js` (Phase 0).

---

## Sécurité (récapitulatif)

| Verrou | Effet |
|--------|-------|
| `verifyAdmin` | Seuls les admins Ma Zone accèdent |
| Sandbox-only | Impersonation + lab refusés hors sandbox / hors prod |
| Cible strictement démo | `userId` doit être dans `demo_entities` — impossible de devenir / agir sur un vrai compte |
| Aucune écriture à l'impersonation | Émission de jeton uniquement |
| Actions via organes | Pas de SQL métier dans le labo |

---

## Hors périmètre (volontaire)

- Scan QR par caméra sur web (remplacé plus tard par une action de labo Identity).
- Organes futurs (Event, Marketing…) : ajoutés comme actions de labo quand ils existeront.
- Déploiement / build de production du Back Office.
- Vue iframe « téléphone » multi-acteurs (écarté au profit du nouvel onglet).

---

## Checklist d'implémentation

| # | Tâche | Zone |
|---|-------|------|
| 1 | `sandbox.js` + gardes | Backend |
| 2 | `explorer.js` + routes actors | Backend |
| 3 | `POST /impersonate` | Backend |
| 4 | `lab/actionRegistry` + actions Wallet | Backend |
| 5 | `demoWorld.purgeUsers` + refactor reset | Backend |
| 6 | Passage de jeton `#labToken` dans `AppContext` | Mobile |
| 7 | Scaffold `admin-web/` (Vite + React) | Front |
| 8 | `WorldPage` | Front |
| 9 | `ExplorerPage` (Devenir X + pouvoirs) | Front |
| 10 | Vérifs bout-en-bout + `CHANTIER_LABORATOIRE_V1` + PDF | Docs |

---

## Critère de succès

À la fin de cet incrément, l'équipe Ma Zone doit pouvoir :

1. se connecter au Back Office en tant qu'admin ;
2. lancer `quartier_anime` depuis l'UI ;
3. explorer les acteurs du monde généré ;
4. cliquer « Devenir » sur un habitant → ouvrir sa vraie app citoyen dans un nouvel onglet ;
5. de même pour un commerçant (Cockpit) et un livreur ;
6. émettre un objet Wallet via un pouvoir de labo (organe Wallet) ;
7. resetter le monde **proprement**, y compris les traces créées pendant l'imitation ;
8. ajouter demain une nouvelle action de labo **sans modifier le cœur**.

C'est le terrain sur lequel Ma Zone pourra continuer à inventer Ma Zone — en y entrant.
