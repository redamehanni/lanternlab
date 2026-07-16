# Chantier livré — Laboratoire Vivant (Back Office · Phase 2 du Bac à Sable)

**Date :** 16 juillet 2026  
**Statut :** Livré et vérifié — 3ᵉ fondation du Bac à Sable  
**Références :** [PLAN_LABORATOIRE_VIVANT.md](PLAN_LABORATOIRE_VIVANT.md) · [CHANTIER_WORLD_FACTORY_V1.md](CHANTIER_WORLD_FACTORY_V1.md) · [CHANTIER_EPEE_SHELL_V1.md](CHANTIER_EPEE_SHELL_V1.md)  
**Public :** Architectes Ma Zone — compte rendu d'implémentation

---

## Document de référence

| Format | Fichier | Usage |
|--------|---------|-------|
| **HTML** | `CHANTIER_LABORATOIRE_V1.html` | Lecture dans Cursor / navigateur |
| **Markdown** | `CHANTIER_LABORATOIRE_V1.md` | Partage / édition |
| **PDF** | `CHANTIER_LABORATOIRE_V1.pdf` | Impression / revue |

---

## Résumé exécutif

Le **Laboratoire** est livré : une app web (`admin-web/`) qui permet à l'équipe Ma Zone de **générer un monde**, d'**explorer ses acteurs**, et surtout de **devenir** n'importe quel acteur démo pour vivre sa vraie application Ma Zone.

Deux principes intangibles ont guidé chaque décision et sont respectés dans le code :

> **Entrer dans un acteur = s'authentifier, pas muter.**  
> **Le laboratoire n'écrit jamais en base directement : toute action passe par un organe.**

Vérifié en headless : **12 assertions vertes** (génération → exploration → jeton d'imitation → action via organe Wallet → reset par appartenance). Build `admin-web` OK. Lints propres.

---

## Ce qui a été construit

```
admin-web (React+Vite · :5174)
   Login → Monde (World Factory) → Explorateur → « Devenir X » / Pouvoirs du labo
        │
        ▼
/api/admin (verifyAdmin · sandbox-only)
   /impersonate ─────► jeton citoyen réel (0 écriture)
   /lab/actions ─────► organes (Wallet aujourd'hui)
   /world/actors ────► lecture seule
   /world/run|reset ─► World Factory (reset par appartenance)
        │  nouvel onglet #labToken
        ▼
Vraie app Ma Zone web (:8081) → Client / Cockpit / Livreur → organes réels
```

---

## Fichiers créés

### Backend

| Fichier | Rôle |
|---------|------|
| `backend/src/lib/sandbox.js` | Garde `isSandbox()` / `requireSandbox` (pouvoirs coupés en prod) |
| `backend/src/lib/worldFactory/explorer.js` | Exploration **lecture seule** des acteurs démo + `isDemoUser` |
| `backend/src/lib/worldFactory/demoWorld.js` | `purgeUsers` — reset par **clôture d'appartenance** FK-safe |
| `backend/src/lib/lab/actionRegistry.js` | Registre déclaratif des actions (Open/Closed) |
| `backend/src/lib/lab/actions/wallet.js` | Actions Wallet (`issue` / `consume`) via l'organe |
| `backend/src/lib/lab/index.js` | Orchestrateur mince des actions de labo |

### Back Office web (`admin-web/`)

| Fichier | Rôle |
|---------|------|
| `package.json`, `vite.config.js`, `index.html`, `postcss.config.js` | Socle Vite + React |
| `src/config.js`, `src/api.js` | Endpoints + client HTTP (jeton admin) |
| `src/App.jsx`, `src/main.jsx`, `src/styles.css` | Coquille + navigation Monde/Explorateur |
| `src/pages/LoginPage.jsx` | Connexion admin |
| `src/pages/WorldPage.jsx` | Recettes, génération paramétrée, batches, reset |
| `src/pages/ExplorerPage.jsx` | Acteurs, détail, « Devenir X », pouvoirs du labo |

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `backend/src/routes/admin.js` | Routes explorateur, `/impersonate`, `/lab/actions` |
| `backend/src/lib/worldFactory/index.js` | `resetBatch` / `resetAllDemo` délèguent à la purge par appartenance |
| `mobile/src/context/AppContext.js` | Passage de jeton `#labToken` (web) via `/api/users/me` |

---

## API ajoutée (sous `/api/admin`, `verifyAdmin`)

| Méthode | Route | Garde | Rôle |
|---------|-------|-------|------|
| `GET` | `/world/actors` | admin | Acteurs démo (filtres `type`, `batchId`) — lecture seule |
| `GET` | `/world/actors/:id` | admin | Détail d'un acteur (profil + gravitation) |
| `POST` | `/impersonate` | admin + sandbox + **démo-only** | Émet un jeton citoyen réel |
| `GET` | `/lab/actions` | admin + sandbox | Actions de labo déclarées |
| `POST` | `/lab/actions/:actionId` | admin + sandbox + **démo-only** | Exécute une action via un organe |

---

## Impersonation — clé de voûte

`POST /api/admin/impersonate { userId }` :

1. refuse hors sandbox ;
2. refuse si `userId` n'est pas un acteur démo (`demo_entities`) → **impossible de devenir un vrai citoyen** ;
3. émet `jwt.sign({ id, name, email, role }, JWT_SECRET, { expiresIn: '12h' })` — le **même** jeton qu'un login réel, donc sockets / dispatch / chat fonctionnent nativement ;
4. **aucune écriture en base**.

Côté app, l'onglet ouvert avec `#labToken=<jeton>` résout l'acteur via `/api/users/me`, ouvre la session (isolée par onglet) et atterrit dans la bonne app.

---

## Pouvoirs du labo — via organes uniquement

Registre Open/Closed identique à celui des recettes World Factory. Actions livrées (organe Wallet) :

| Action | Organe appelé |
|--------|---------------|
| `issue_wallet_object` | `walletEngine.issueObject({ sourceEngine: 'lab' })` |
| `consume_wallet_object` | `walletEngine.consumeObject()` |

Brancher un futur organe (Event, Marketing, Identity…) = ajouter un fichier dans `lib/lab/actions/`, **sans toucher au cœur**.

---

## Reset par appartenance (durcissement)

Problème résolu : les lignes créées pendant l'imitation (commandes, objets Wallet…) n'étaient pas tracées, donc non nettoyées. `demoWorld.purgeUsers` supprime désormais la **clôture d'appartenance** des acteurs démo, en ordre FK-safe, avec garde stricte (seuls les users de `demo_entities`). Le monde redevient réellement propre.

---

## Vérifications

| Check | Résultat |
|-------|----------|
| Test headless (12 assertions) | Vert |
| `npm run build` (admin-web) | OK |
| Lints backend / mobile / admin-web | Aucune erreur |
| Impersonation limitée aux acteurs démo | Vérifié (`isDemoUser`) |
| Reset purge les traces d'imitation | Vérifié (objets + user à 0) |
| Aucune écriture directe dans les actions de labo | Respecté (délégation Wallet) |

---

## Lancement (dev)

| Processus | Commande | Port |
|-----------|----------|------|
| Backend | `cd backend && npm run dev` | 4000 |
| App Ma Zone web | `cd mobile && npm run web` | 8081 |
| Back Office | `cd admin-web && npm install && npm run dev` | 5174 |

Admin : `node backend/scripts/create-admin.js` → `admin@mazone.local` / `admin1234`.

---

## Ouvertures d'architecture préservées (non implémentées)

Conformément à la vision, rien ne ferme ces évolutions futures :

- **État global du monde** : `explorer.listActors` + comptes agrégés forment déjà le socle d'un tableau de bord d'activité.
- **Contrôle du temps** : le World Factory est déjà pensé pour faire *évoluer* un monde (avancer le temps, expirer des objets) via orchestration d'organes.
- **Scénarios reproductibles** : le registre d'actions de labo permet d'enchaîner des actions ; une future « recette de scénario » les composerait.
- **Historique des simulations** : `demo_batches` trace déjà chaque exécution (rejeu / comparaison possibles).

Chaque capacité future reste un **module indépendant** ajouté sans modifier le cœur du laboratoire.

---

## CTO — auto-évaluation

| Qualité | Note |
|---------|------|
| Fidélité au plan validé | Forte |
| Impersonation = authentification (jamais mutation) | Respecté |
| Actions via organes uniquement | Respecté |
| Reset réellement propre | Résolu (par appartenance) |
| Extensibilité (Open/Closed) | Forte (recettes + actions + adaptateurs) |
| Dette introduite | Faible (`postcss.config.js` local pour neutraliser le Tailwind racine) |

**Verdict :** le Bac à Sable possède désormais ses trois fondations — **World Factory**, **Épée**, **Laboratoire**. Ma Zone peut être vécue avant ses habitants, et chaque futur organe s'y branchera sans refonte. C'est l'infrastructure qui permettra à Ma Zone d'inventer Ma Zone.
