# Analyse architecturale B++ — Comportement vivant, contexte, relations, patrimoine

**Date :** 14 juillet 2026  
**Statut :** Compte rendu d'architecte — à valider — aucune implémentation  
**Références :** [PLAN_ETUDE_WALLET_ENGINE.md](PLAN_ETUDE_WALLET_ENGINE.md) (B) · [ANALYSE_OBJET_NUMERIQUE_VIVANT.md](ANALYSE_OBJET_NUMERIQUE_VIVANT.md) (B+)

---

## Résumé exécutif

Suite à l'adoption de l'architecture B+ (séparation Entitlement / DigitalObject, capacités déclaratives, facette souvenir, enrichissement gouverné), quatre nouvelles réflexions émergent : le **comportement vivant**, la **réactivité au contexte**, les **relations entre objets**, et le **patrimoine numérique** du citoyen. Une question philosophique clôt la réflexion : le Wallet devient-il le protocole de communication de Ma Zone ?

**Verdict d'architecte :** B+ reste la référence. Les quatre réflexions s'intègrent par des mécanismes **déclaratifs et émergents**, sans logique nouvelle dans le noyau. On nomme cette évolution **B++**.

**Point critique :** le Wallet n'est pas le protocole de communication (anti-pattern organe-dieu). Le `DigitalObject` devient le **contrat d'interaction partagé** — un langage commun, pas un routeur de messages.

---

## 1. Rappel du socle B+

| Couche | Rôle | Exemples |
|--------|------|----------|
| **Dure (Entitlement)** | Créance porteuse de valeur, transactionnelle | issue, consume, revoke, transfer |
| **Souple (DigitalObject)** | Contenant vivant, face citoyen | capacités, présentation, souvenir, références live |
| **Registre de types** | Déclare kinds, transitions, capacités, facettes | sans toucher au noyau |
| **Ledger append-only** | Audit + biographie de l'objet | chaque transition journalisée |
| **API publique + événements** | Séparation des organes | jamais d'accès DB direct |

B++ n'ajoute aucune brique transactionnelle. Elle formalise et étend la couche déclarative.

---

## 2. Réflexion 1 — Le comportement vivant

### Intuition

Un billet avant concert propose Offrir, Partager, Ajouter au calendrier. Après le concert, ces actions disparaissent et de nouvelles apparaissent : Voir les photos, Revoir le programme, Partager son souvenir, Voir les autres éditions.

Ce n'est plus seulement un enrichissement de contenu. L'objet **adapte les interactions** qu'il propose.

### Analyse

**Bonne nouvelle : ce mécanisme est déjà dans B+.** Les descripteurs de capacités étaient déclarés par état (`availableInStates`). Un objet `active` expose un menu ; le même objet `consumed` en expose un autre.

Le comportement n'est pas un attribut figé de l'objet. C'est une **fonction de son état** :

```
Capacités disponibles = f(kind, état, contexte)
```

La variable `contexte` est nouvelle — et fait l'objet de la réflexion 2.

### Formalisation B++

| Élément | Statut |
|---------|--------|
| Capacités par état | Déjà dans B+ — à nommer explicitement |
| Recalcul à chaque transition | Déjà prévu (machine à états → projection) |
| Comportement = f(état) | Formalisation B++ |
| Comportement = f(état, contexte) | Extension B++ (voir §3) |

**Aucune modification du noyau transactionnel requise.**

---

## 3. Réflexion 2 — Réagir au contexte

### Intuition

- À 150 m du lieu, le bouton principal du billet devient « Scanner mon QR ».
- Quand le commerçant prépare la commande, le ticket Click & Collect change.
- Quand le retrait est effectué, l'objet devient automatiquement un souvenir d'achat.

Le contexte semble faire évoluer les objets naturellement.

### Analyse critique — deux natures de contexte

| Type | Exemples | Nature | Qui gère |
|------|----------|--------|----------|
| **Contexte ambiant** | GPS, proximité, heure locale, état du device | Volatil, propre au terminal | **Bord** (client mobile) |
| **Contexte de domaine** | Commande préparée, retrait effectué, événement commencé | Transition d'état provoquée par un organe | **Organe émetteur** via API Wallet |

**Erreur à éviter :** faire du Wallet un « Context Engine » qui connaît le GPS, calcule des proximités, ou ingère des signaux du device. Cela le couplerait au terminal, le rendrait intestable et violerait la séparation des responsabilités.

### Solution B++ : guards contextuels déclaratifs, évalués au bord

Le registre déclare des **guards** sur les capacités :

```json
{
  "id": "scan_qr",
  "label": "Scanner mon QR",
  "availableInStates": ["active"],
  "primaryWhen": "proximity < 150m && eventStarted",
  "handledBy": "qr_identity",
  "invocation": "qr_identity.scan"
}
```

- Le **Wallet** expose les capacités et leurs guards (déclaratifs).
- Le **client mobile** évalue le contexte ambiant (GPS, heure) et détermine l'action primaire.
- Les **organes** provoquent les transitions de domaine via l'API (`consume`, `enrichObject`).

### Schéma — répartition des responsabilités

```
┌─────────────────────────────────────────────────────────────┐
│  BORD (client mobile)                                       │
│  ┌──────────────────┐    ┌─────────────────────────────┐ │
│  │ Contexte ambiant   │───▶│ Évaluateur de guards        │ │
│  │ (GPS, heure, etc.) │    │ (primaryWhen → action UI)   │ │
│  └──────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▲ capacités + guards
┌─────────────────────────────┴───────────────────────────────┐
│  COEUR (Wallet)                                             │
│  Registre : capacités déclaratives + guards par kind/état  │
│  État de l'objet (projection)                               │
└─────────────────────────────┬───────────────────────────────┘
                              ▲ transitions d'état
┌─────────────────────────────┴───────────────────────────────┐
│  ORGANES (Orders, Event, Marketing…)                        │
│  Contexte de domaine → issue / consume / enrichObject       │
└─────────────────────────────────────────────────────────────┘
```

### Verdict

Le contexte **mérite d'exister architecturalement**, mais uniquement comme **guards déclaratifs évalués au bord**. Pas de Context Engine dans le Wallet.

**Danger signalé :** un moteur de contexte dans le cœur Wallet = couplage terminal, complexité, violation SRP.

---

## 4. Réflexion 3 — Relations entre objets

### Intuition

- Un billet est associé à un coupon boisson.
- Une réservation est liée à un badge obtenu.
- Une commande génère ensuite une carte de fidélité.

Les objets racontent une histoire commune.

### Analyse critique

L'intuition est juste. Le risque est réel : transformer le Wallet en **base de graphe** avec traversées, cascades et règles inter-objets. Ce serait une explosion de complexité.

### Solution B++ : relations légères, typées, unidirectionnelles

Table conceptuelle `object_relations` :

```
{ fromId, toId, relationType, createdBy, createdAt }
```

Types de relation :

| relationType | Exemple |
|--------------|---------|
| `bundledWith` | Billet + coupon boisson |
| `derivedFrom` | Carte fidélité issue d'une commande |
| `unlocks` | Badge débloqué par une réservation |
| `relatedTo` | Lien générique |

### Règles dures

1. Le Wallet stocke **qu'une relation existe** et **son type**. Il n'interprète pas son sens métier.
2. **Pas de cascade** dans le cœur (« si A consommé alors B change »). Cette logique appartient à l'organe émetteur, via événements.
3. **Pas de traversée profonde** (pas de requête graphe N niveaux).
4. Une relation est un **enrichissement** comme un autre — append-only, journalisé.

### Verdict

Relations **modélisables dès maintenant, activables plus tard**. Pas dans le premier périmètre d'implémentation. L'histoire commune **émerge** des références, sans moteur dédié.

**Danger signalé :** moteur de graphe avec cascades = complexité exponentielle, couplage inter-objets dans le cœur.

---

## 5. Réflexion 4 — Patrimoine numérique du citoyen

### Intuition

Tous les objets n'ont pas la même destinée. Une procuration disparaîtra. Un billet de festival, un badge, un achat marquant pourraient devenir une **collection personnelle** — une mémoire numérique de la vie de quartier. Le Wallet deviendrait le patrimoine numérique du citoyen.

### Analyse

La bibliothèque de souvenirs **émerge naturellement** de B+ :

- Distinction Entitlement / DigitalObject
- Consommation non destructive
- Facette souvenir
- Ledger = biographie

C'est une **projection / requête** sur les objets du citoyen. Pas besoin d'un organe « Collection » séparé.

### Extension B++ : politique de rétention déclarée par kind

| retention | Exemple | Destinée |
|-----------|---------|----------|
| `ephemeral` | Procuration, ticket retrait consommé | Disparaît ou archivé silencieusement |
| `keepsake` | Billet festival, badge, achat marquant | Persiste comme patrimoine |
| `entitlement_only` | Droit purement fonctionnel | Pas de facette souvenir |

Le « patrimoine numérique » = filtre `retention = keepsake` sur les objets du citoyen.

### Verdict

**Émergence + un attribut déclaratif (`retention`).** C'est une vue, pas une nouvelle structure. Rien de plus.

---

## 6. Question philosophique — Le Wallet est-il le protocole de communication ?

### L'impression

Au fil des réflexions, le Wallet semble devenir le langage commun entre tous les organes : vivre, évoluer, proposer des actions, dialoguer, changer de propriétaire, devenir souvenir.

### Analyse — l'impression est à moitié juste

Il faut séparer deux choses :

| Concept | Rôle | Qui le porte |
|---------|------|--------------|
| **Couche des noms** | Ce que le citoyen possède, comment ça se présente et agit | **Wallet** — le `DigitalObject` est le **contrat d'interaction partagé** |
| **Couche des verbes** | Comment les organes se notifient mutuellement | **Event Engine** (futur) — le bus de messages |

### Ce que le Wallet EST

- Le **standard d'objets vivants** de Ma Zone
- Le **vocabulaire commun** : issue, consume, enrich, transfer, memory, capabilities
- Le **registre des droits** du citoyen

### Ce que le Wallet N'EST PAS

- Le **routeur de messages** entre organes
- Le **bus d'événements** (rôle du futur Event Engine)
- L'**organe-dieu** dont tout dépend

Si tout transite par le Wallet, il viole le principe transversal (transversal = dépend d'aucun, mais si tout en dépend, il devient central de fait).

### Schéma — deux couches distinctes

```
┌─────────────────────────────────────────────────────────────┐
│  COUCHE DES NOMS (Wallet)                                   │
│  DigitalObject = contrat d'interaction partagé              │
│  « Ce que le citoyen possède et comment il interagit »      │
└─────────────────────────────┬───────────────────────────────┘
                              │ expose au citoyen
                              ▼
                        ┌──────────┐
                        │ Citoyen  │
                        └──────────┘

┌─────────────────────────────────────────────────────────────┐
│  COUCHE DES VERBES (Event Engine — futur)                   │
│  Bus d'événements inter-organes                             │
│  « Comment les organes se notifient »                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
        Marketing ──▶ Event Engine ◀── Event
        Orders    ──▶           ◀── Dispatch
                              │
                              ▼ notifie (wallet:object_*)
                        Wallet Engine
```

### Verdict

**Oui**, vous construisez plus qu'un portefeuille : un **standard d'objets vivants**.  
**Non**, ce n'est pas le protocole de communication — c'est le **vocabulaire commun**. La nuance protège l'écosystème.

---

## 7. Synthèse B++ — ce qui s'ajoute à B+

| Extension | Mécanisme | Où vit |
|-----------|-----------|--------|
| Comportement vivant | Capacités = f(kind, état, contexte) | Registre (déclaratif) |
| Contexte ambiant | Guards `primaryWhen` | Registre + évaluation au bord |
| Contexte de domaine | Transitions d'état | Organes → API Wallet |
| Relations | Arêtes typées append-only | Table `object_relations` (future) |
| Patrimoine | Attribut `retention` par kind | Registre + projection/requête |
| Contrat partagé | DigitalObject comme lingua franca | Wallet (couche des noms) |

**Tout est déclaratif ou émergent. Rien n'ajoute de logique métier dans le cœur.**

---

## 8. Dangers architecturaux signalés

| Danger | Conséquence | Mitigation |
|--------|-------------|------------|
| Context Engine dans le Wallet | Couplage terminal, intestable | Guards évalués au bord uniquement |
| Graphe de relations avec cascades | Complexité exponentielle | Relations légères, pas de cascade dans le cœur |
| Wallet = routeur de messages | Organe-dieu, violation transversalité | Event Engine pour le bus ; Wallet pour les noms |
| Confondre contexte ambiant et domaine | Logique GPS dans le cœur | Séparation stricte bord / organes |
| Patrimoine = nouvel organe | Sur-ingénierie | Projection sur objets existants + `retention` |

---

## 9. Impact sur les principes non négociables

| Principe | Impact B++ |
|----------|------------|
| Wallet stocke et gouverne des droits | Conservé |
| Générique, piloté par registre | **Renforcé** (guards, retention, relations déclaratives) |
| Journal append-only | Conservé |
| Payloads opaques | Conservé |
| API publique uniquement | Conservé |
| Consommation idempotente et atomique | Conservé |
| Centré propriétaire, Zone-aware | Conservé |
| Ne pas toucher Dispatch / Communication | Conservé |
| Organe transversal (dépend d'aucun) | **Clarifié** — Wallet ≠ bus de communication |

Aucun principe affaibli. Deux clarifiés, un renforcé.

---

## 10. Interfaces conceptuelles enrichies (B++)

```
// Existant B+ (inchangé dans l'esprit)
issueObject({ ownerId, kind, payload, zoneId?, expiresAt?, sourceEngine, sourceRef })
consumeObject({ objectId, consumerEngine, idempotencyKey })
enrichObject({ objectId, enrichmentPayload, sourceEngine, idempotencyKey })
getCapabilities(objectId) → [{ id, label, icon, handledBy, invocation, primaryWhen?, guard? }]

// Nouveau B++
linkObjects({ fromId, toId, relationType, sourceEngine, idempotencyKey })
getRelatedObjects(objectId, relationType?) → [{ objectId, relationType }]

// Registre enrichi (déclaratif, pas d'API runtime)
ObjectKind {
  kind, retention, transferable, memoryEnabled,
  capabilities: [{ id, label, availableInStates, primaryWhen?, handledBy, invocation }],
  transitions: [...]
}
```

---

## 11. Ce qui reste rigide vs ce qui devient souple

### Rigide (couche dure — inchangé)

- Transactions d'entitlement (issue, consume, revoke, transfer)
- Atomicité, idempotence, anti double-dépense
- Journal append-only
- Accès uniquement via API publique

### Souple (couche déclarative — étendue en B++)

- Présentation et contenu riche (résolution live)
- Menu d'actions (capacités + guards contextuels)
- Facette souvenir post-consommation
- Enrichissement par les organes émetteurs
- Relations légères entre objets (future)
- Politique de rétention (patrimoine vs éphémère)
- Évaluation du contexte ambiant (au bord, pas dans le cœur)

---

## 12. Recommandation finale

### Verdict

**B+ est adopté comme référence.** B++ formalise et étend la couche déclarative sans toucher au noyau transactionnel. Les quatre réflexions sont saines, adoptables, et protégées des pièges identifiés.

### Architecture retenue : B++

```
B+ (référence adoptée)
  + Comportement = f(kind, état, contexte) — formalisation explicite
  + Guards contextuels déclaratifs, évalués au bord (pas de Context Engine)
  + Relations légères typées, append-only, sans cascade (modélisable, activable plus tard)
  + Attribut retention par kind → patrimoine émerge comme projection
  + DigitalObject nommé comme contrat d'interaction partagé (couche des noms)
  + Event Engine (futur) porte la couche des verbes — distinct du Wallet
```

### Prochaine étape

Sur validation de cette analyse B++, intégrer l'ensemble (B → B+ → B++) dans l'étude complète `ETUDE_ARCHITECTURE_WALLET_ENGINE.md` avant tout chapitre d'implémentation.

---

*Document généré le 14 juillet 2026 — Analyse architecturale B++, design uniquement, aucune implémentation.*
