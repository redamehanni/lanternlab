# Chantier livré — Identity Engine v1 (Ma Zone)

**Date :** 15 juillet 2026
**Statut :** Livré et vérifié — première version professionnelle
**Références :** [ETUDE_IDENTITY_ENGINE.md](ETUDE_IDENTITY_ENGINE.md) · [ETUDE_QR_IDENTITY_ENGINE.md](ETUDE_QR_IDENTITY_ENGINE.md) · [CHANTIER_WALLET_ADR_002_005.md](CHANTIER_WALLET_ADR_002_005.md)
**Public :** Architectes Ma Zone — compte rendu d'implémentation après validation officielle

---

## Résumé exécutif

Le **Identity Engine** est le deuxième organe transversal de Ma Zone. Sa responsabilité unique : répondre avec certitude à la question *« Qui est cette personne ? »* — sans jamais accorder un droit ni prendre une décision métier.

**Verdict :** fondation saine, alignée sur les conventions du Wallet Engine (registre déclaratif + moteur transactionnel + journal append-only + routes HTTP bornées). Architecture miroir, faible couplage, zéro dépendance vers les organes métier.

**Évolution conceptuelle actée :** l'organe s'appelle **Identity Engine** ; le **QR n'est qu'un canal de présentation** (le premier, en V1). Le handle opaque produit par le serveur est neutre vis-à-vis du transport.

---

## Philosophie respectée

| Principe | Implémentation |
|----------|----------------|
| Identifie uniquement | `verifyPresentation` retourne une revendication minimale, jamais un droit |
| Ne décide jamais | Aucun appel vers Wallet, Orders, Event, Marketing… |
| Organe transversal | Consommé par les autres ; dépend uniquement de `users` + `auth` |
| Le QR n'est pas l'organe | Handle neutre côté serveur ; encodage QR au bord client (`IdentityScreen`) |
| Simplicité V1 | Un seul `purpose: identity`, un seul canal (QR), aucun stub NFC/BLE |

---

## Architecture backend

### Modèle en couches

```
Identity Engine (cœur neutre)
├── identityRegistry.js   → purposes, TTL, rôles vérificateurs, contrat de divulgation
├── identityEngine.js     → issue / verify / revokeAll, ledger, socket
└── routes/identity.js    → GET /token, POST /verify, GET /history

Bord client (canal de présentation)
└── IdentityScreen.js     → encode le handle en QR (react-native-qrcode-svg)
```

### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `backend/src/lib/identityRegistry.js` | Registre des `purposes` ; contrat de divulgation ; validation fail-fast |
| `backend/src/lib/identityEngine.js` | Moteur transactionnel ; handle opaque ; revendication bornée |
| `backend/src/routes/identity.js` | Routes HTTP montées sous `/api/identity` |
| `backend/src/db/index.js` | Tables `identity_presentations` + `identity_events` (modifié) |
| `backend/src/index.js` | Montage `app.use('/api/identity', identityRoutes)` (modifié) |

### Modèle de données

**`identity_presentations`** — projection d'état courant

| Colonne | Rôle |
|---------|------|
| `id` | Identifiant du jeton |
| `user_id` | Citoyen propriétaire |
| `handle` | Valeur opaque (`mz:id:…`) — canal-agnostique |
| `purpose` | Usage (`identity` en V1) |
| `status` | `active` · `used` · `expired` · `revoked` |
| `expires_at` | TTL court (120 s par défaut) |

**`identity_events`** — journal append-only (audit)

| Colonne | Rôle |
|---------|------|
| `presentation_id`, `subject_id`, `verifier_id`, `verifier_role` | Traçabilité |
| `purpose`, `channel` | Contexte (`channel` = audit, défaut `qr`) |
| `type` | `issued` · `validated` · `rejected` · `revoked` |
| `outcome`, `reason`, `idempotency_key` | Résultat et anti-rejeu |

### API publique du moteur (in-process)

**Commandes :**

| Fonction | Rôle |
|----------|------|
| `issuePresentation({ userId, purpose })` | Émet un handle rotatif ; expire le jeton actif précédent |
| `verifyPresentation({ handle, verifierId, verifierRole, purpose, channel, idempotencyKey })` | Valide ou rejette ; retourne revendication |
| `revokeAll({ userId, reason })` | Invalide tous les jetons actifs (logout, incident) |

**Requêtes :**

| Fonction | Rôle |
|----------|------|
| `getActivePresentation(userId, purpose?)` | Jeton actif courant |
| `getVerificationHistory(userId)` | Historique des identifications réussies |

### Routes HTTP

| Méthode | Route | Auth | Rôle |
|---------|-------|------|------|
| `GET` | `/api/identity/token` | `verifyToken` | Citoyen — obtient un handle frais |
| `POST` | `/api/identity/verify` | `verifyToken` + rôle vérificateur | Résout une identité à partir d'un handle |
| `GET` | `/api/identity/history` | `verifyToken` | Citoyen — historique de ses vérifications |

`revokeAll` n'est **pas** exposé en HTTP : primitive interne (déconnexion / incident).

### Sécurité (Approche C)

- **Handle opaque** : `mz:id:` + 48 octets aléatoires (`crypto.randomBytes`) — aucun secret dans le QR
- **Usage unique** : un jeton consommé passe en `used`
- **TTL court** : 120 s ; rotation automatique toutes les 45 s côté client
- **Idempotence** : `idempotency_key` sur scan — rejouer ne double pas l'effet
- **Divulgation minimale** : seuls `displayName` et `photoUrl` exposés ; jamais email, rôle, ni identifiant technique au-delà de `subjectId`
- **Rôles vérificateurs** : `merchant` et `driver` pour `purpose: identity` ; `client` rejeté (403)
- **Contrat fail-fast** : allowlist de divulgation validée au chargement du registre

### Revendication d'identité vérifiée

```json
{
  "subjectId": "uuid-utilisateur",
  "displayName": "Marie",
  "photoUrl": "/uploads/...",
  "purpose": "identity",
  "verifiedAt": "2026-07-15T10:30:00Z",
  "verificationId": "uuid-evenement-audit"
}
```

Pas de liste de billets. Pas de « accès autorisé ».

### Événements Socket.io

| Événement | Cible | Quand |
|-----------|-------|-------|
| `identity:verified` | `user_{subjectId}` | Scan réussi (notification citoyen) |
| `identity:revoked` | `user_{userId}` | Tous les jetons invalidés |

---

## Architecture mobile

### Fichiers créés / modifiés

| Fichier | Nature |
|---------|--------|
| `mobile/src/screens/client/IdentityScreen.js` | Écran plein écran : avatar, nom, QR rotatif |
| `mobile/src/api/index.js` | `getIdentityToken`, `verifyIdentity`, `getIdentityHistory` |
| `mobile/src/navigation/index.js` | Stack racine `ClientRoot` + modal `Identity` plein écran |
| `mobile/src/components/client/ClientDrawerContent.js` | Pictogramme QR à côté de l'avatar (menu hamburger) |
| `mobile/package.json` | `react-native-svg`, `react-native-qrcode-svg` (via `expo install`) |

### Parcours utilisateur

1. L'utilisateur ouvre le **menu hamburger** (drawer).
2. En haut : photo de profil + **petit bouton QR** (badge accent à côté de l'avatar).
3. Un clic ouvre **Mon identité** en plein écran (modal).
4. L'écran affiche avatar, nom, et un **QR du handle** qui se renouvelle automatiquement.
5. Fermeture par chevron en haut.

L'emplacement définitif dans la navigation globale pourra évoluer lors du chantier UX « Double Identité » ; la racine `ClientRoot` permet d'ouvrir l'identité depuis n'importe où.

### Dépendances ajoutées

| Package | Usage |
|---------|-------|
| `react-native-svg` | Rendu SVG (requis par qrcode-svg) |
| `react-native-qrcode-svg` | Affichage du QR du handle |

Installées via `npx expo install` — compatibles Expo Go, sans rebuild natif.

---

## Communication avec les autres organes

```
Citoyen → GET /identity/token → handle
         → IdentityScreen encode en QR

Vérificateur (futur) → POST /identity/verify → revendication

Organe métier (Event, Orders…) → applique SA logique
                              → wallet.consumeObject(...) si pertinent
```

L'Identity Engine n'a participé qu'à l'identification. Il ignore billets, commandes et décisions.

---

## Vérifications effectuées

| Vérification | Résultat |
|--------------|----------|
| Lints (backend + mobile) | Aucune erreur |
| Tables DB au boot | Créées automatiquement |
| Registre fail-fast | Contrat de divulgation validé |
| `issuePresentation` | Handle `mz:id:…`, TTL/rotate présents |
| Rotation | Un seul jeton actif ; handle différent à chaque émission |
| `verifyPresentation` | Revendication correcte ; pas d'email/rôle |
| Usage unique | Handle déjà utilisé → 409 |
| Idempotence | Même `idempotencyKey` → même revendication, un seul événement |
| Rôle non autorisé | Client → 403 |
| Handle inconnu | 404 |
| Jeton expiré | 409 |
| `revokeAll` | Tous les actifs révoqués |
| Historique | Validations listées, sans données sensibles |
| Boot serveur | Healthcheck OK sur port isolé |

**21 assertions** — toutes passent.

---

## Décisions architecturales (ADR) — statut

| ID | Décision | Statut |
|----|----------|--------|
| ADR-ID-001 | Identifie uniquement ; jamais de décision métier | Implémenté |
| ADR-ID-002 | Handle opaque + validation serveur (Approche C) | Implémenté |
| ADR-ID-003 | Architecture miroir du Wallet | Implémenté |
| ADR-ID-004 | V1 = identité personnelle ; objet Wallet = extension | Respecté |
| ADR-ID-005 | Contrat de divulgation, fail-fast au chargement | Implémenté |
| ADR-ID-006 | Zéro dépendance vers organes métier | Respecté |
| ADR-ID-007 | Mode hors-ligne préparé, non développé | Respecté |
| ADR-ID-008 | Identity Engine ; QR = canal | Implémenté |
| ADR-ID-009 | Champ `channel` (audit) ; présentation au bord | Implémenté |

---

## Volontairement hors périmètre V1

| Élément | État |
|---------|------|
| Scanner vérificateur (app marchand) | Endpoint `POST /verify` prêt ; UI non construite |
| Branchement Orders / Event (retrait, accès) | À la demande des organes métier |
| Canaux NFC, Apple/Google Wallet, BLE | Architecture ouverte ; aucun code |
| `revokeAll` au logout | Primitive prête ; branchement auth à faire |
| Purposes multiples (`access`, `pickup`, `civic`) | Registre extensible ; un seul purpose en V1 |
| IdentityContext + socket temps réel | Événements définis ; context optionnel non ajouté |

---

## Correspondance Wallet ↔ Identity

| Wallet | Identity |
|--------|----------|
| `walletRegistry.js` / `defineKind` | `identityRegistry.js` / `definePurpose` |
| `walletEngine.js` | `identityEngine.js` |
| `digital_objects` + `digital_object_events` | `identity_presentations` + `identity_events` |
| `issueObject` | `issuePresentation` |
| `consumeObject` | `verifyPresentation` (identifie, ne consomme pas) |
| Contrat capabilities (ADR-005) | Contrat de divulgation |
| `show_qr` (objet Wallet) | Canal QR identité personnelle (distinct) |

---

## Prochaines étapes suggérées

1. Brancher `revokeAll` sur le logout (`auth` / `AppContext`).
2. Construire l'app vérificatrice marchand (scan + `POST /verify`) lors de l'intégration Orders ou Event.
3. Premier cas d'usage réel : retrait Click & Collect (Orders identifie via Identity, consomme via Wallet).
4. Documenter le contrat d'intégration pour les futurs organes.

---

## Conclusion

L'Identity Engine v1 constitue une **fondation d'identité numérique** minimaliste, robuste et évolutive. Le QR est le premier canal ; le cœur reste neutre. Aucune sur-ingénierie, aucune régression, alignement total avec la philosophie Ma Zone et le Wallet Engine.
