# 04 — Audit sécurité (ANSSI + OWASP)

Date : 2026-07-26 · Code post Organe d’Orchestration E0–E8  
Référentiels : Guide ANSSI navigateur v2.0 (R1–R63) · OWASP Cheat Sheets · CNIL fiches 6 / 18

> **Compléments.** Deux documents prolongent celui-ci et doivent être lus avec lui :
>
> - [06-ASVS-5.0.md](./06-ASVS-5.0.md) — le volet **OWASP ASVS 5.0.0** (345 exigences, niveau L2 visé) : cycle de vie du mot de passe, révocation de session, journalisation de sécurité.
> - [07-SURFACES-EXPOSABLES.md](./07-SURFACES-EXPOSABLES.md) — la revue **orientée attaquant** : ce qu'un tiers voit dans les bundles, atteint par deep link, injecte dans les champs de saisie, ou découvre en sondant le backend. Elle a produit **six écarts P0 supplémentaires** (S-01 à S-04, S-14, S-15) qui n'apparaissent pas ci-dessous, parce que ce ne sont pas des défauts de code mais des portes ouvertes par conception : outil de laboratoire compilé dans le build mobile, authentification web contournée par défaut, identifiants d'administration dans le bundle.
>
> **Le plus grave de tout l'audit y figure**, pas ici : `mobile/src/context/AppContext.js` ouvre une session à partir d'un jeton passé dans une URL, sans garde de production (S-01).

Format obligatoire pour chaque écart : **constat → pourquoi → nouvelle version → gravité**.

---

## A. Points déjà corrigés (ne pas re-ouvrir sans régression)

| Contrôle | Preuve | Statut |
|----------|--------|--------|
| JWT sans fallback hardcodé | `backend/src/config/env.js` — fail-fast prod, secrets historiques refusés | OK |
| CORS allowlist prod | `env.js` + `app.js` — `*` interdit en prod | OK |
| ACL commandes | `lib/access.js`, `routes/orders.js`, `routes/v1/orders.js` | OK |
| ACL sockets order/conversation | `socket/handlers.js` | OK |
| Conversations modernes | `communicationEngine` + canAccessThread | OK |
| helmet + rate-limit | `app.js` | OK |
| Sandbox refusée en prod | `env.js` + `sandbox.js` | OK |
| Coffre intégrations AES-GCM | `lib/integration/secrets.js` | OK |
| HMAC webhooks | `signature.js` + connecteur Shopify | OK |
| `service_role` hors client | `src/lib/supabase/*` anon seulement | OK |
| Tests access | `backend/test/security/access.test.js` | OK |
| CI architecture / Loi 17 | `.github/workflows/ci.yml`, `scripts/check-loi-17.sh` | OK |

---

## B. Écarts restants — P0

### B1 — IDOR sur `/api/messages` legacy

- **Constat :** `backend/src/routes/messages.js` — GET/POST avec `verifyToken` seul, pas de `canViewOrder`
- **Pourquoi c’était vulnérable :** un utilisateur authentifié qui connaît (ou énumère) un `orderId` lit et écrit le chat d’une autre commande, et peut émettre dans la room socket associée
- **Ce que fera la nouvelle version :** appeler `canViewOrder(req.user, orderId)` (404 si refus, comme les orders) ; à terme déprécier la route au profit de `/api/conversations` + sunset
- **Référentiel :** OWASP Access Control / IDOR · CNIL fiche 8 · OWASP Authorization
- **Gravité :** P0

### B2 — Uploads non filtrés + `/uploads` public

- **Constat :** multer sans `fileFilter` (`users.js`, `stores.js`, `products.js`) ; `originalname` partiellement conservé ; `app.use('/uploads', express.static(...))` sans auth (`app.js`)
- **Pourquoi c’était vulnérable :** dépôt de fichiers non-image (HTML/SVG) ; chemins dangereux ; photos de profil accessibles à quiconque possède l’URL
- **Ce que fera la nouvelle version :** allowlist MIME `image/jpeg|png|webp` ; nom UUID + extension serveur ; service via route authentifiée ou URL signée à durée limitée (plus de static brut)
- **Référentiel :** OWASP File Upload · ANSSI R11 · CNIL fiche 6
- **Gravité :** P0

### B3 — Absence totale d’information / consentement à la collecte

- **Constat :** `RegisterScreen.js`, `auth.js` — aucun lien privacy/CGU, aucune case, aucune table `consents`
- **Pourquoi c’est non conforme :** art. 12–14 RGPD — la personne n’est pas informée ; impossible de prouver une acceptation contractuelle ou un consentement
- **Ce que fera la nouvelle version :** écran d’acceptation avec liens vers `docs/legal/` ; enregistrement horodaté (`consents`) ; blocage de l’inscription sans acceptation
- **Référentiel :** CNIL fiches 12 et 15
- **Gravité :** P0

### B4 — Droits d’effacement et de portabilité absents

- **Constat :** `users.js` — seulement GET/PUT `/me` + adresses ; Settings = placeholder
- **Pourquoi c’est non conforme :** art. 17 et 20 non exercables ; conservation de facto indéfinie
- **Ce que fera la nouvelle version :** `DELETE /api/users/me` (cascade + anonymisation comptable) ; `GET /api/users/me/export` JSON ; boutons dans Settings
- **Référentiel :** CNIL fiche 13
- **Gravité :** P0

---

## C. Écarts — P1

### C1 — Self-register `merchant` / `driver`

- **Constat :** `auth.js` — rôle choisi parmi `client|merchant|driver`
- **Pourquoi vulnérable :** création de comptes commerçant/livreur sans validation → surface abus (fausses boutiques, accès outils)
- **Nouvelle version :** inscription publique forcée `client` ; élévation via invitation / validation admin
- **Référentiel :** CNIL fiche 7–8 · OWASP Access Control
- **Gravité :** P1

### C2 — JWT en AsyncStorage

- **Constat :** `mobile/src/utils/storage.js` + `AppContext.js` — token + profil JSON
- **Pourquoi vulnérable :** stockage non chiffré, extractible (malware, backup non sécurisé, debug)
- **Nouvelle version :** `expo-secure-store` (Keychain/Keystore) pour le token ; minimiser le profil persisté
- **Référentiel :** ANSSI R23 · OWASP Mobile · CNIL fiche 6
- **Gravité :** P1

### C3 — Logs PII (sockets)

- **Constat :** `socket/handlers.js` — `console.log` avec **nom** utilisateur ; `logger.js` ne redacte pas email/phone/name/address
- **Pourquoi vulnérable :** PII dans stdout / agrégateurs logs
- **Nouvelle version :** IDs opaques seulement ; étendre `REDACTED_KEYS` ; remplacer `console.log` par `logger`
- **Référentiel :** OWASP Logging · CNIL fiche 6
- **Gravité :** P1

### C4 — Pas de validation Zod / schéma

- **Constat :** validation ad hoc dans les routes
- **Pourquoi vulnérable :** payloads malformés, mass assignment, erreurs imprévisibles
- **Nouvelle version :** schemas Zod (auth, orders, intents v1, metadata upload)
- **Référentiel :** OWASP Input Validation · CNIL fiche 18
- **Gravité :** P1

### C5 — Next.js sans CSP / HSTS

- **Constat :** `next.config.ts` — nosniff, referrer, X-Frame seulement
- **Pourquoi vulnérable :** XSS plus impactante ; pas de HSTS (downgrade TLS)
- **Nouvelle version :** CSP (ANSSI R14) + HSTS (R2) + Permissions-Policy en prod
- **Référentiel :** ANSSI R2, R14–R18
- **Gravité :** P1 (legacy ; critique si site public)

### C6 — Pas de `npm audit` en CI

- **Constat :** `.github/workflows/ci.yml` — tests + architecture, pas d’audit deps
- **Pourquoi vulnérable :** CVE connues peuvent merger sans alerte
- **Nouvelle version :** job `npm audit --omit=dev --audit-level=high`
- **Référentiel :** CNIL fiche 9 · OWASP Vulnerable Dependency
- **Gravité :** P1

### C7 — Info RGPD manquante sur branchement connecteur

- **Constat :** `MesIntegrationsScreen.js` — scopes/capacités, pas de finalités Ma Zone ni destinataire nommé pour le commerçant
- **Pourquoi non conforme :** le commerçant n’est pas clairement informé du traitement côté Ma Zone (art. 13) avant OAuth
- **Nouvelle version :** écran d’information (données syncées, conservation jetons, droit de débranchement) avant redirection OAuth
- **Référentiel :** CNIL fiche 12 · art. 13
- **Gravité :** P1

### C8 — Conservation illimitée

- **Constat :** pas de purge messages/commandes/journaux métier
- **Pourquoi non conforme :** art. 5-1-e (limitation de conservation)
- **Nouvelle version :** durées actées (DECISIONS) + jobs de purge / anonymisation ; stratégie pour journaux append-only
- **Référentiel :** CNIL fiche 14
- **Gravité :** P1

### C9 — Permission photothèque non déclarée iOS

- **Constat :** `imagePicker.js` utilise la galerie ; `app.json` n’a que `NSCameraUsageDescription`
- **Pourquoi :** rejet store / usage sans information claire
- **Nouvelle version :** ajouter `NSPhotoLibraryUsageDescription` (+ Android si besoin)
- **Référentiel :** stores Apple · CNIL fiche 12
- **Gravité :** P1

---

## D. Grille ANSSI (sélection applicable)

| ID | Recommandation | Verdict |
|----|----------------|---------|
| R1 | TLS | Hors prod local HTTP — **à imposer en déploiement** |
| R2 | HSTS | Absent Next · N/A API JSON |
| R14 | CSP | Absent Next · désactivé volontairement API |
| R18 | X-Frame-Options | OK Next |
| R21 | Referrer-Policy | OK Next |
| R23 | Pas de secrets en stockage local | **Écart** JWT AsyncStorage |
| R39–R41 | CORS Origin | **OK** prod |
| R61–R63 | Composants tiers | Partiel (Loi 17 OK, audit deps manquant) |

---

## E. Sous-traitants techniques à sécuriser contractuellement

Avant prod : DPA (art. 28) avec hébergeur backend, et documentation des transferts Shopify / cartes. Le coffre et le disconnect sont des **mesures techniques** ; ils ne remplacent pas le contrat.
