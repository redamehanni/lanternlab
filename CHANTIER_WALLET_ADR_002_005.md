# Chantier livré — Wallet Engine · ADR-002 & ADR-005

**Date :** 15 juillet 2026
**Statut :** Livré et vérifié — évolutions additives, rétrocompatibles
**Références :** [REVUE_ARCHITECTURE_WALLET_N2.md](REVUE_ARCHITECTURE_WALLET_N2.md) · [AUDIT_WALLET_ENGINE_MAZONE.md](AUDIT_WALLET_ENGINE_MAZONE.md)
**Public :** Architectes Ma Zone — compte rendu d'implémentation après validation de la revue n°2

---

## Résumé exécutif

Suite à la validation de la revue d'architecture n°2, deux décisions actées comme **prioritaires, additives et non-bloquantes** ont été implémentées sur le Wallet Engine :

- **ADR-002** — un espace `display` distinct du `payload`, pour débloquer listes, recherche et interface sans jamais exposer le sens métier de l'objet.
- **ADR-005** — un contrat de capabilities `handledBy: 'wallet'` vérifié au chargement du registre, garde-fou empêchant le Wallet de devenir un « super-moteur ».

Les deux évolutions sont **rétrocompatibles** : aucune donnée existante n'est cassée, la migration DB est non destructive, le moteur a été testé bout-en-bout, et les lints sont propres.

**Volontairement hors périmètre** (à valider séparément) : branchement Orders → `pickup_ticket`, migration familles → vues, relations entre objets.

---

## ADR-002 — Espace `display` séparé du `payload`

### Problème traité

Le `payload` d'un objet numérique est **opaque** : le Wallet ne l'interprète jamais (principe fondateur). Mais les interfaces (listes, recherche, fiches) ont besoin de quelques métadonnées communes de présentation. Les extraire du payload aurait forcé le moteur à connaître le métier — anti-pattern.

### Décision

Introduire un descripteur **`display`** structuré, léger et distinct, à côté du `payload` :

| Champ | Rôle |
|-------|------|
| `title` | Titre affiché (remplace le `label` générique du registre) |
| `subtitle` | Ligne secondaire (lieu, date, code…) |
| `category` | Catégorie visuelle indicative (`culture`, `commerce`, `ville`…) |
| `primaryDate` | Date principale pour tri/affichage |
| `thumbnail` / `icon` | Illustration éventuelle |

Le moteur **stocke et restitue** ce descripteur sans jamais l'interpréter : c'est l'organe émetteur qui le remplit. L'UI se replie automatiquement sur le `label` du registre quand `display` est absent → **zéro régression** sur les objets déjà émis.

### Modifications

**Backend**

- `backend/src/db/index.js`
  - Colonne `display TEXT` ajoutée à `digital_objects` (dans le `CREATE TABLE` pour les bases neuves).
  - Migration non destructive `addColumnIfMissing('digital_objects', 'display', 'TEXT')` pour les bases existantes (appliquée automatiquement au boot).
- `backend/src/lib/walletEngine.js`
  - `issueObject({ display })` sérialise le descripteur (JSON) en base.
  - `rowToObject` renvoie `display` parsé, en **champ distinct** du `payload`.

**Mobile**

- `mobile/src/screens/client/WalletFamilyScreen.js`
  - Affiche `display.title` / `display.subtitle`, repli sur `label`.
- `mobile/src/screens/client/WalletObjectDetailScreen.js`
  - Titre depuis `display.title`, sous-titre si présent, repli sur `label`.

**Démo**

- `backend/scripts/seed-wallet-demo.js`
  - Objets de démonstration enrichis d'un `display` pour rendre l'amélioration visible immédiatement.

### Extrait — moteur

```js
const obj = wallet.issueObject({
  ownerId,
  kind: 'event_ticket',
  payload: { seat: 'A1' },              // opaque, jamais lu par le moteur
  display: {                            // présentation, stockée/restituée telle quelle
    title: 'Concert de quartier',
    subtitle: 'Place centrale · 15 août',
    category: 'culture',
    primaryDate: '2026-08-15',
  },
  sourceEngine: 'event',
});
```

---

## ADR-005 — Contrat de capabilities (garde-fou anti « super-moteur »)

### Problème traité

Les capabilities décrivent ce qu'un objet **propose** (« Que puis-je faire avec toi ? »). Le risque architectural : qu'une capacité déclarée `handledBy: 'wallet'` embarque peu à peu de la logique métier, transformant le Wallet en moteur applicatif.

### Décision

Une capacité ne peut être `handledBy: 'wallet'` **que** si elle appartient à l'une de ces deux catégories strictement bornées :

1. **Transition d'état** sur l'objet lui-même (`offer`/`transfer`, `revoke`, `reserve`, `release`) ;
2. **Affichage pur** de données déjà stockées (`show_qr`, `show_code`, `view_memory`, `view_receipt`).

Toute autre action doit être déléguée à `source` (organe émetteur) ou `device`. Cette règle est **exécutée**, pas seulement documentée : une allowlist est vérifiée au **chargement du registre** (fail-fast).

### Modifications

- `backend/src/lib/walletRegistry.js`
  - `WALLET_HANDLED_ALLOWLIST` : ensemble des identifiants de capacités autorisés en `handledBy: 'wallet'`.
  - `validateCapabilityContract()` : parcourt tous les `kinds` au chargement ; si une capacité `handledBy: 'wallet'` n'est pas dans l'allowlist, **le serveur refuse de démarrer** avec un message explicite.
  - Contrat et validateur exportés pour transparence et testabilité.

### Extrait — validation fail-fast

```js
function validateCapabilityContract() {
  for (const def of Object.values(KINDS)) {
    for (const cap of def.capabilities) {
      if (cap.handledBy === 'wallet' && !WALLET_HANDLED_ALLOWLIST.has(cap.id)) {
        throw new Error(
          `[WalletRegistry] Violation du contrat de capacités : "${cap.id}" ` +
          `du kind "${def.kind}" est handledBy: 'wallet' hors allowlist. ` +
          `Déléguez-la à 'source' ou 'device'.`
        );
      }
    }
  }
}

validateCapabilityContract(); // au chargement du module
```

Le registre actuel passe la validation : toutes les capacités Wallet existantes sont des transitions ou de l'affichage de données stockées.

---

## Vérifications effectuées

| Vérification | Résultat |
|--------------|----------|
| Lints (backend + mobile) | Aucune erreur |
| Migration DB au boot | `display` ajoutée automatiquement |
| Chargement du registre | Contrat de capacités validé (OK) |
| `issueObject({ display })` → relecture | `display.title` / `subtitle` intacts |
| Séparation `display` / `payload` | `payload` restitué intact et distinct |
| Allowlist | Accepte `show_qr`, rejette une capacité métier arbitraire |

---

## Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `backend/src/db/index.js` | Colonne `display` + migration non destructive |
| `backend/src/lib/walletEngine.js` | `issueObject`/`rowToObject` gèrent `display` |
| `backend/src/lib/walletRegistry.js` | Allowlist + validation du contrat de capabilities |
| `backend/scripts/seed-wallet-demo.js` | Objets de démo enrichis d'un `display` |
| `mobile/src/screens/client/WalletFamilyScreen.js` | Affichage `display.title`/`subtitle` |
| `mobile/src/screens/client/WalletObjectDetailScreen.js` | Titre/sous-titre depuis `display` |

---

## Hors périmètre (à valider séparément)

| Chantier | Raison du report |
|----------|------------------|
| Branchement Orders → `pickup_ticket` | Touche un flux en production ; validation dédiée souhaitable |
| Familles → vues (ADR-001) | Migration additive, à traiter lors du chantier UX global |
| Relations entre objets (ADR-004) | Reporté jusqu'à l'Event Engine, comme acté dans la revue n°2 |

---

## Conclusion

Les deux évolutions renforcent la fondation sans en altérer la simplicité : le `display` sépare proprement présentation et entitlement, et le contrat de capabilities transforme un principe (« le Wallet n'est pas un moteur métier ») en **garantie vérifiée à l'exécution**. Aucune régression, aucune dette introduite. Le Wallet Engine reste un organe transversal, plus lisible et mieux protégé qu'avant ce chantier.
