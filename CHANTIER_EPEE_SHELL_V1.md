# Chantier livré — Phase 1 · Shell Épée (Merchant Workspace)

**Date :** 16 juillet 2026  
**Statut :** Livré — premier incrément UI du Bac à Sable (pilier Épée)  
**Références :** [PLAN_EPEE_SHELL_PHASE_1.md](PLAN_EPEE_SHELL_PHASE_1.md) · [ETUDE_BAC_A_SABLE_MAZONE.md](ETUDE_BAC_A_SABLE_MAZONE.md) · [CHANTIER_WORLD_FACTORY_V1.md](CHANTIER_WORLD_FACTORY_V1.md)  
**Public :** Architectes Ma Zone — compte rendu d'implémentation

---

## Document de référence

| Format | Fichier | Usage |
|--------|---------|-------|
| **HTML** | `CHANTIER_EPEE_SHELL_V1.html` | Lecture dans Cursor / navigateur |
| **Markdown** | `CHANTIER_EPEE_SHELL_V1.md` | Partage / édition |
| **PDF** | `CHANTIER_EPEE_SHELL_V1.pdf` | Impression / revue externe (Finder ou Aperçu) |

---

## Résumé exécutif

L'ancien **tableau de bord commerçant monolithique** (4 onglets) a été remplacé par le **Shell Épée** : un poste de travail modulaire dont l'accueil est un **Cockpit de briefing**, et dont les modules sont déclarés dans un **registre unique**.

**Aucune logique métier nouvelle.** L'Épée est une **surface** : elle orchestre les écrans et les données des organes existants (Orders, Promotions, Communication, Store). Les organes futurs (Événements, Fidélité, Collaborations) sont déjà déclarés en « Bientôt » sans code mort.

**Principe architectural acté et documenté dans le code :**

> L'Épée n'est jamais un organe. Elle orchestre. Elle ne décide jamais.

---

## Philosophie respectée

| Principe | Implémentation |
|----------|----------------|
| Surface ≠ organe | Aucune règle métier dans `epee/` ni dans le Cockpit |
| Open/Closed | Nouveau module = une entrée dans `moduleRegistry.js` |
| Briefing, pas exhaustif | Sections plafonnées (max 4 cartes) dans `briefing.js` |
| Familles renommables | Libellés centralisés dans `FAMILIES` |
| Organs futurs visibles | Modules `comingSoon` dans le drawer, sans route |
| Capacité `store` | Modules verrouillés tant qu'aucune boutique n'existe |
| Pas de sur-ingénierie | Pas d'entitlements serveur, pas d'analytics organe |

---

## Architecture livrée

```
MerchantRoot (Drawer)
       │
       ├── MerchantDrawerContent  ← lit le registre (familles + modules)
       │
       └── EpeeStack
             ├── Cockpit (accueil)
             │     ├── charge store / orders / promotions / unread
             │     ├── buildBriefing(adapters)
             │     └── tuiles Accès rapides (registre)
             │
             └── Écrans d'organes existants
                   ManageStock · MerchantOrders · ManagePromotions
                   MesClients · MerchantInbox · CreateStore
                   MerchantStats · Profile · Chat · …
```

```
mobile/src/epee/
├── moduleRegistry.js     ← familles + modules déclaratifs
├── briefing.js           ← agrège les adaptateurs
└── adapters/
    ├── index.js          ← point d'extension unique
    ├── marketplace.js    ← commandes en cours → carte priorité
    ├── messages.js       ← non-lus → carte priorité
    ├── store.js          ← vitrine incomplète → carte vie
    ├── promotions.js     ← promos actives / absentes → carte vie
    └── clients.js        ← clients servis → carte vie
```

---

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `mobile/src/epee/moduleRegistry.js` | Familles, modules, `isUnlocked`, `getModulesByFamily` |
| `mobile/src/epee/briefing.js` | `buildBriefing(ctx)` → `{ priorities, life }` |
| `mobile/src/epee/adapters/*.js` | Adaptateurs purs `ctx → cartes[]` |
| `mobile/src/screens/merchant/MerchantCockpitScreen.js` | Accueil Épée (briefing + accès rapides + stubs) |
| `mobile/src/screens/merchant/MerchantStatsScreen.js` | Module Piloter — agrégation lecture seule Orders |
| `mobile/src/components/merchant/BriefingCard.js` | Carte de briefing présentationnelle |
| `mobile/src/components/merchant/MerchantDrawerContent.js` | Menu latéral piloté par le registre |

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `mobile/src/navigation/index.js` | `MerchantTabs` → `MerchantRoot` (Drawer + `EpeeStack`) |

## Fichier orphelin (non cassant)

| Fichier | Note |
|---------|------|
| `mobile/src/screens/merchant/DashboardScreen.js` | Plus référencé ; conservé volontairement (suppression possible en nettoyage) |

---

## Registre des modules (Phase 1)

### Familles

| Id | Libellé | Icône |
|----|---------|-------|
| `vendre` | Vendre | `pricetags-outline` |
| `animer` | Animer | `megaphone-outline` |
| `reseau` | Réseau | `people-outline` |
| `piloter` | Piloter | `compass-outline` |

### Modules branchés (`enabled: true`)

| Id | Famille | Écran | Entitlement |
|----|---------|-------|-------------|
| `catalog` | Vendre | `ManageStock` | `store` |
| `orders` | Vendre | `MerchantOrders` | `store` |
| `promotions` | Animer | `ManagePromotions` | `store` |
| `clients` | Réseau | `MesClients` | `store` |
| `messages` | Réseau | `MerchantInbox` | — |
| `store` | Piloter | `CreateStore` | — |
| `stats` | Piloter | `MerchantStats` | `store` |

### Modules « Bientôt » (`comingSoon`)

| Id | Famille | Organe futur |
|----|---------|--------------|
| `events` | Animer | Event Engine |
| `loyalty` | Animer | Loyalty |
| `collaborations` | Réseau | Collaboration |

---

## Cockpit — composition UX

Règle actée : **un briefing du matin, pas un tableau exhaustif.**

1. **En-tête** — greeting + nom du commerce + bouton menu (drawer)
2. **Vos priorités** — cartes urgentes (commandes, messages) ou état « Tout est sous contrôle »
3. **Accès rapides** — tuiles par famille (modules `enabled` uniquement)
4. **Vie du commerce** — contexte (vitrine, promos, clients)
5. **Aller plus loin** — stubs Objectifs / Suggestions / Santé (cadres posés, organes futurs)

État vide dédié si aucune boutique : CTA « Créer mon commerce ».

---

## Adaptateurs (contrat)

Chaque adaptateur expose :

```
{ id, build(ctx) → Card[] }
```

Une carte typique :

| Champ | Rôle |
|-------|------|
| `id` | Identifiant stable |
| `section` | `priority` ou `life` |
| `moduleId` | Lien vers le registre |
| `icon` / `tone` | Présentation |
| `title` / `subtitle` / `value` | Contenu |
| `route` | Écran cible dans `EpeeStack` |
| `priority` | Tri décroissant dans la section |

Le Cockpit charge le contexte (`store`, `orders`, `promotions`, `unreadMessages`) et le passe à `buildBriefing`. **Aucun adaptateur ne fait d'appel réseau.**

---

## Navigation

### Avant (monolithe)

```
MerchantTabs
 ├── DashTab → Dashboard + stacks produits/promos
 ├── OrdersTab
 ├── InboxTab
 └── ProfileTab
```

### Après (Shell Épée)

```
MerchantRoot (Drawer)
 └── EpeeMain → EpeeStack
       Cockpit | CreateStore | ManageStock | MerchantOrders
       ManagePromotions | MesClients | MerchantInbox
       MerchantStats | Profile | Chat | …
```

Tous les parcours internes des écrans d'organes restent valides : ils cohabitent dans le **même stack**.

---

## Points d'extension (prochaines étapes)

| Besoin | Action | Fichier touché |
|--------|--------|----------------|
| Brancher Event Engine | `enabled: true` + `route` + adaptateur | `moduleRegistry.js` + `adapters/` |
| Renommer une famille | Éditer `FAMILIES` | `moduleRegistry.js` |
| Enrichir le briefing | Ajouter un adaptateur | `adapters/index.js` |
| Objectifs / Santé | Remplacer les stubs du Cockpit | `MerchantCockpitScreen.js` |
| Back Office web | Surface admin séparée (hors mobile) | Futur chantier |
| Nettoyage | Supprimer `DashboardScreen.js` | Optionnel |

---

## Vérifications

| Check | Résultat |
|-------|----------|
| Lints sur fichiers créés / modifiés | Aucune erreur |
| Routes Cockpit / drawer ↔ `EpeeStack` | Alignées |
| Références `MerchantTabs` / `DashboardScreen` dans le code navigable | Plus aucune (hors docs + fichier orphelin) |
| Principe surface / organe | Respecté (pas de logique métier dans `epee/`) |

---

## Hors périmètre (volontaire)

- UI Back Office administrateur (web)
- Nouvelles recettes World Factory
- Event / Marketing / Loyalty / Collaboration (déclarés seulement)
- Entitlements serveur / abonnements
- Suppression de `DashboardScreen.js`

---

## CTO — auto-évaluation

| Qualité | Note |
|---------|------|
| Fidélité au plan Phase 1 | Forte |
| Séparation surface / organe | Forte |
| Extensibilité (registre + adaptateurs) | Forte |
| UX briefing (pas d'exhaustivité) | Respectée |
| Dette introduite | Faible (`DashboardScreen` orphelin ; Inbox a encore son titre interne sous le header stack) |

**Verdict :** Phase 1 Shell Épée livrable. Le Bac à Sable a maintenant ses deux premières fondations livrées — **World Factory (backend)** et **Épée Shell (mobile)** — prêtes à accueillir les organes suivants sans refactor de coquille.
