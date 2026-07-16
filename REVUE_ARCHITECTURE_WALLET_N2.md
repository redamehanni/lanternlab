# Revue d'architecture n°2 — Wallet Engine

**Date :** 15 juillet 2026  
**Statut :** Document de décisions (ADR) — fondation à valider — aucune implémentation  
**Références :** [AUDIT_WALLET_ENGINE_MAZONE.md](AUDIT_WALLET_ENGINE_MAZONE.md) · tag `v9.0`  
**Public :** Architectes Ma Zone — dernière étape avant validation officielle du Wallet Engine

---

## Résumé exécutif

Cette revue confronte six points soulevés lors du contre-audit du Wallet Engine v1. L'objectif n'est pas d'avoir raison, mais de construire la meilleure fondation possible.

**Verdict global :** la fondation tient. Deux évolutions sont actées (espace `display`, contrat de capabilities). Deux clarifications conceptuelles (familles = vues, souvenir = facette). Deux non-actions assumées (relations, états déjà couverts).

| Point | Verdict | Action |
|-------|---------|--------|
| 1. Familles | Critique en partie juste | Familles = vues de présentation ; moteur garde `kind` |
| 2. Payload / display | Critique juste — meilleure évolution | Ajouter un espace `display` distinct du `payload` |
| 3. Souvenirs | Choix actuel défendu | Facette, pas nouvelle nature ni état |
| 4. Relations | Prématuré | Ne rien construire ; `sourceRef` suffit pour l'instant |
| 5. Capabilities | Séparation OK, à blinder | Contrat `handledBy: wallet` + validation registre |
| 6. États | Déjà implémenté | Rien ; composition DRY en réserve |

**Statut proposé :** Fondation Wallet Engine **validée**, avec évolutions documentées et reportées à un chantier ultérieur.

---

## Point 1 — Les familles d'objets

### Choix actuel

Le moteur connaît `kind` (type intrinsèque) et en dérive une `family` via le registre. La colonne `family` est stockée dans `digital_objects`. L'API `getWalletByFamilies()` regroupe les objets par ces familles pour l'écran mobile.

### Ce que je défends

Le **`kind` doit rester dans le moteur**. C'est une propriété intrinsèque et gouvernante : elle pilote les transitions autorisées, la rétention, les capacités. Ce n'est pas négociable.

### Ce que je concède

La critique est **juste à 80 %**. Les « familles de demain » proposées ne sont pas des familles au sens actuel :

| Vue future | Nature réelle |
|------------|---------------|
| Mes souvenirs | Filtre : `status terminal + isMemory` |
| Mes objets actifs | Filtre : `status = active` |
| Mes favoris | Tag posé par le citoyen |
| Culture, Commerce, Ville | Collections transversales |

Aucune de ces vues n'est un mapping `kind → billets`. Ce sont des **vues de présentation**, pas une taxonomie moteur.

### Comparaison des approches

| | Familles dans le moteur (actuel) | Familles = couche UI (proposé) |
|--|----------------------------------|--------------------------------|
| **Avantages** | Regroupement simple, une requête | Flexibilité totale des vues ; moteur plus pur |
| **Inconvénients** | Figé (6 familles) ; fuite présentation → moteur | Couche UI à maintenir ; mapping kind → vue |
| **Évolutivité** | Faible (changer une vue = toucher registre + colonne) | Forte (nouvelles vues sans toucher le moteur) |

### Décision retenue (ADR-001)

**Séparer taxonomie et présentation.**

- **Moteur** : expose `kind` (+ éventuellement un `category` indicatif dérivé du registre, jamais gouvernant).
- **Présentation** : les « familles » et « collections » deviennent des **vues déclaratives** (filtres sur kind/status/tags), côté config UI ou endpoint dédié.
- **Migration** : la colonne `family` reste tolérée comme **cache de lecture dérivé du registre**, mais n'est plus la source de vérité. Migration future, additive, non urgente.

---

## Point 2 — Le payload et les métadonnées communes

### Choix actuel

Le `payload` est opaque au moteur (JSON libre). Seuls `zone_id` et `expires_at` existent en colonnes gouvernantes. Les listes affichent le `label` **du kind** (« Billet d'événement »), pas le titre réel de l'objet.

### Limite identifiée

Aujourd'hui, dans `WalletFamilyScreen`, deux billets différents affichent tous les deux « Billet d'événement ». Le titre « Concert de quartier » est enfoui dans le `payload` opaque — **inaccessible aux listes et à la recherche** sans casser l'opacité. C'est un vrai défaut d'expérience et d'architecture.

### Comparaison

| | Payload seul (actuel) | Métadonnées communes dans payload | Espace `display` séparé (retenu) |
|--|----------------------|-----------------------------------|----------------------------------|
| **Flexibilité** | Maximale | Maximale | Maximale pour payload |
| **Listes / recherche** | Impossible sans parser payload | Possible mais casse opacité | Native, sans interprétation métier |
| **Risque fourre-tout** | Faible | Élevé (mélange droit + présentation) | Faible (trois espaces distincts) |

### La résolution élégante — trois espaces, pas deux

| Espace | Nature | Le moteur… |
|--------|--------|-----------|
| `payload` | Données d'entitlement (droit, valeur) | ne lit jamais, ne branche jamais |
| **`display`** (nouveau) | Descripteur de présentation standardisé | stocke et retourne, ne branche jamais |
| Colonnes gouvernantes | État (`status`, `retention`, `zone_id`…) | lit et gouverne |

Champs `display` proposés : `title`, `subtitle`, `thumbnail`, `icon`, `primaryDate`, `category`.

Le moteur traite `display` comme **opaque au sens logique** (aucune décision métier) mais **lisible pour listes, recherche et tri**. C'est le « contrat d'interaction partagé » de B++ : chaque objet se présente dans un langage commun.

### Schéma des trois espaces

```
┌─────────────────────────────────────────────────────────┐
│  digital_objects                                        │
├─────────────────────────────────────────────────────────┤
│  COUCHE GOUVERNANTE (moteur lit et décide)              │
│  status, retention, zone_id, expires_at, owner_id, kind │
├─────────────────────────────────────────────────────────┤
│  COUCHE PRÉSENTATION (moteur stocke, ne décide pas)     │
│  display: { title, subtitle, thumbnail, icon, ... }     │
├─────────────────────────────────────────────────────────┤
│  COUCHE ENTITLEMENT (moteur ne lit jamais)              │
│  payload: { ... données métier opaques ... }            │
└─────────────────────────────────────────────────────────┘
```

### Décision retenue (ADR-002)

**Introduire un descripteur `display` séparé du `payload`.** C'est la seule évolution du moteur recommandée comme prioritaire. À implémenter dans un chantier ultérieur ; à acter dès maintenant comme direction officielle.

---

## Point 3 — Les souvenirs

### Question posée

Le souvenir est-il un état supplémentaire ? Une nouvelle nature d'objet ? Le billet consommé reste-t-il un billet ?

### Choix actuel

Un objet consommé avec `memoryEnabled: true` et `retention: keepsake` obtient `isMemory: true`. Les capacités basculent (Offrir disparaît, Revoir le souvenir apparaît). L'objet **persiste** avec le même `id` et le même ledger.

### Ce que je défends fermement

**Ni nouvel état, ni nouvelle nature — une facette de présentation.**

Trois niveaux à ne pas confondre :

| Niveau | Exemple billet consommé | Mutabilité |
|--------|-------------------------|------------|
| **Nature** (`kind`) | `event_ticket` | Immuable |
| **État** (`status`) | `consumed` | Gouverné par machine à états |
| **Facette** (`isMemory`) | Mode souvenir activé | Dérivé : terminal + memoryEnabled + retention |

**Pourquoi le billet reste un billet :**

- **Philosophiquement** : « le même objet continue de vivre » — changer de nature, c'est tuer l'objet et en créer un successeur.
- **Techniquement** : l'identité (`id`) et le ledger (`digital_object_events`) doivent persister. Le souvenir tire sa valeur de son histoire.

### Comparaison

| | Nouvel état `memory` | Nouvelle nature `keepsake` | Facette dérivée (retenu) |
|--|---------------------|---------------------------|--------------------------|
| Identité objet | Conservée | Perdue (transformation) | Conservée |
| Ledger | Continu | Rupture ou migration | Continu |
| Complexité moteur | Faible | Élevée | Minimale |
| Alignement B+ | Partiel | Non | Total |

### Décision retenue (ADR-003)

**Conserver le modèle facette.** Vocabulaire officiel : nature / état / facette. Aucune modification du moteur.

---

## Point 4 — Relations entre objets

### Question posée

Faut-il préparer architecturalement des liens entre objets (festival → billet → coupon → badge) ?

### Choix actuel

Objets indépendants. Pas de table de relations. Champs `sourceEngine` + `sourceRef` pour tracer l'origine.

### Analyse

**L'intuition est légitime à long terme.** L'analyse B++ a déjà tranché la forme : arêtes typées, unidirectionnelles, append-only, sans moteur de graphe ni cascade.

**Mais c'est prématuré aujourd'hui :**

- Zéro organe métier n'est branché au Wallet.
- Construire un système de relations maintenant = sur-ingénierie exactement ce que nous voulons éviter.
- Le schéma actuel **n'empêche rien** : ajouter `object_relations` plus tard est purement additif.

**Ce qui existe déjà :** `sourceEngine` + `sourceRef`. Un organe Event qui émet billet + coupon + badge pour le même festival peut leur donner une référence commune. Le regroupement « objets d'un même événement » est **déjà possible** sans table de relations.

### Décision retenue (ADR-004)

**Ne rien implémenter.** Documenter la forme cible (arêtes typées : `bundledWith`, `derivedFrom`, `unlocks`, `relatedTo`). S'appuyer sur `sourceRef` pour les regroupements simples. Introduire les relations explicites uniquement quand un organe concret (Event) en démontrera le besoin.

---

## Point 5 — Capabilities : descriptives, jamais exécutives

### Choix actuel

Les capacités sont des **descripteurs** dans le registre : `{ id, label, icon, handledBy, invocation, availableInStates }`. Le moteur filtre et retourne ; il n'exécute jamais. Le mobile affiche un stub Alert.

### Ce que je défends

La séparation **tient** en v1. Le moteur ne connaît pas la logique métier des actions.

### Risque identifié

Le maillon faible : `handledBy: 'wallet'` sur `show_qr` et `offer`. Sans règle explicite, la tentation viendra d'implémenter « juste une petite logique » derrière une capability wallet → dérive vers super-moteur.

### Garde-fou proposé — contrat de capacités

`handledBy: 'wallet'` autorisé **uniquement** pour :

1. **Transitions d'état sur l'objet** (transfer, revoke, reserve) — opérations d'entitlement, légitimement cœur.
2. **Affichage pur de données déjà stockées** (show_qr = rendre l'identité de l'objet).

Tout le reste → `source` (organe émetteur) ou `device` (OS).

**Validation exécutable :** au chargement du registre, refuser un `handledBy: 'wallet'` hors allowlist d'ids. Le « Wallet ne devient jamais un super-moteur » devient une **contrainte**, pas une promesse.

### Décision retenue (ADR-005)

**Garder le modèle descriptif.** Ajouter le contrat de capabilities (règle + validation registre). Évolution documentaire et légère ; à implémenter avec le prochain chantier registre.

---

## Point 6 — États et comportements

### Question posée

Les actions doivent-elles dépendre du cycle de vie, pas seulement du type ?

### Réponse : c'est déjà le cas

Les capacités portent `availableInStates`. `getCapabilities(kind, status)` filtre par état courant.

Exemple `event_ticket` dans le registre :

| Capacité | États disponibles |
|----------|-------------------|
| Afficher mon QR | `active` |
| Offrir | `active` |
| Ajouter au calendrier | `active` |
| Revoir le souvenir | `consumed`, `expired` |

Billet actif → QR, Offrir, Calendrier. Billet consommé → Revoir le souvenir. **Exactement le comportement demandé.**

### Nuance défendue

**`kind × état`**, pas l'état seul. Un `loyalty_card` actif et un `event_ticket` actif partagent l'état mais pas les capacités. L'état seul serait insuffisant.

### Option future (réserve)

Si beaucoup de kinds partagent « partager le souvenir » en état terminal : **capacités génériques par état**, composées avec les spécifiques par kind :

```
capabilities(objet) = génériques(état) ⊕ spécifiques(kind, état)
```

Pure DRY ; à activer seulement si le besoin apparaît.

### Décision retenue (ADR-006)

**Aucune évolution nécessaire.** L'architecture accueille déjà l'idée. Composition générique-par-état gardée en réserve.

---

## Synthèse des décisions (ADR)

| ID | Décision | Statut | Implémentation |
|----|----------|--------|----------------|
| ADR-001 | Familles = vues de présentation ; moteur garde `kind` | Acté | Reporté (migration additive) |
| ADR-002 | Espace `display` séparé du `payload` | Acté | Reporté (chantier prioritaire) |
| ADR-003 | Souvenir = facette, pas nouvelle nature | Validé | Inchangé |
| ADR-004 | Relations : ne rien construire ; `sourceRef` suffit | Acté | Reporté (jusqu'à besoin Event) |
| ADR-005 | Contrat capabilities `handledBy: wallet` + validation | Acté | Reporté (avec registre) |
| ADR-006 | Capabilities par `kind × état` | Validé | Inchangé |

---

## Statut final proposé

**Le Wallet Engine v1 (tag `v9.0`) est proposé comme fondation officielle de Ma Zone.**

Conditions :

- Les six points de la revue n°2 sont traités et actés.
- Deux évolutions futures sont documentées (display, contrat capabilities) sans remettre en cause le noyau.
- Aucune modification du code n'est requise pour valider la fondation.
- Les chantiers suivants (intégration Orders, QR Identity, espace display) s'appuient sur cette base.

---

## Prochains chantiers recommandés (ordre)

1. **Espace `display`** — débloque listes, recherche, UX (ADR-002)
2. **Contrat capabilities** — protège la propriété anti super-moteur (ADR-005)
3. **Branchement Orders → `pickup_ticket`** — première intégration organe réelle
4. **Familles → vues** — quand l'UX global le demandera (ADR-001)
5. **Relations explicites** — quand Event Engine existera (ADR-004)

---

*Document généré le 15 juillet 2026 — Revue d'architecture n°2, document de décisions, aucune implémentation.*
