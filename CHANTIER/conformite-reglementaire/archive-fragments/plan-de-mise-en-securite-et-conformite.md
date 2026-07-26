# Plan de mise en sécurité et conformité — Ma Zone

| | |
|---|---|
| **Date** | 2026-07-26 |
| **Remplace** | `PLAN-TRAVAIL.md` (renommé et densifié) |
| **Sources** | [00-synthèse](./00-SYNTHESE-EXECUTIVE.md) · [04](./04-AUDIT-SECURITE.md) · [06-ASVS](./06-ASVS-5.0.md) · [07-surfaces](./07-SURFACES-EXPOSABLES.md) · [08-inventaire entrées](./08-INVENTAIRE-ENTREES.md) · [FD-003](../../FICHE_DISCUSSION/FD-003-conformite-reglementaire-securite-applicative.md) |

> **Honnêteté de couverture.** L’audit initial n’était **pas** exhaustif champ par champ. La passe du 26/07 soir a produit l’[inventaire 08](./08-INVENTAIRE-ENTREES.md) (~63 TextInput mobile, admin, Next, ~100 routes API, sockets, uploads, stockage local). Ce plan intègre ces trouvailles. Ce qui reste hors revue de code : pentest runtime, RLS Supabase cloud, formulaires connecteurs futurs.

Chaque correctif technique : **pourquoi** → **nouvelle version** (détail dans 04 / 06 / 07 / 08).

---

## Phase 0 — Fermer les portes ouvertes par conception

Effort faible. À faire **avant** toute démo sur réseau partagé et avant tout déploiement Next.js.

| ID | Correctif | Effort | Fichiers | Réf. |
|----|-----------|--------|----------|------|
| P0-0a | Retirer `labToken` des builds de production | S | `AppContext.js`, `labToken.js` | S-01 |
| P0-0b | Vider identifiants admin préremplis + retirer le texte affiché | S | `admin-web/.../LoginPage.jsx` | S-04 |
| P0-0c | Limiteur strict sur `POST /api/admin/auth/login` | S | `backend/src/app.js` | S-14 |
| P0-0d | Fail-fast Next sans auth **ou** retirer `src/` (décision D9) | S/M | `src/lib/supabase/*` | S-02 |
| P0-0e | Dev servers sur `127.0.0.1` par défaut | S | `vite.config.js`, `package.json` | S-05 |
| P0-0f | Échapper labels Leaflet | S | `LiveMap.tsx` | S-15 |
| P0-0g | Contrôle de rôle + filtrage propriétaire (web) | M | `middleware.ts`, `data.ts` | S-03 |

**P0-0d/f/g disparaissent si retrait de `src/`.**

---

## Phase A — Gouvernance

| # | Action | Owner | Statut |
|---|--------|-------|--------|
| A1 | Valider [DECISIONS-A-TRANCHER.md](./DECISIONS-A-TRANCHER.md) | Adam + Reda | À faire |
| A2 | Trancher AIPD oui/non | Adam + conseil | À faire |
| A3 | Identité éditeur (placeholders légaux) | Adam | À faire |
| A4 | Médiateur de la consommation | Adam | À faire |
| A5 | Prestataire email (bloque P0-8) | Adam + Reda | À faire |
| A6 | Hébergeur (bloque P0-13, registre, DPA) | Adam + Reda | À faire |
| A7 | Sort du Next.js legacy (D9) | Adam + Reda | À faire |
| A8 | Sort de `labToken` (D10) | Adam + Reda | À faire |
| A9 | Valider FD-003 + ce plan | Adam | À faire |

---

## Phase B — Corpus juridique (bloquant stores)

| Document | Fichier | Statut |
|----------|---------|--------|
| Mentions légales | `docs/legal/mentions-legales.md` | Gabarit |
| Politique de confidentialité | `docs/legal/politique-confidentialite.md` | Gabarit |
| CGU | `docs/legal/cgu.md` | Gabarit |
| CGV intermédiation | `docs/legal/cgv-intermediation.md` | Gabarit |
| Politique cookies | `docs/legal/politique-cookies.md` | Gabarit |
| Procédure violation | `docs/legal/procedure-violation-donnees.md` | Gabarit |
| Procédure droits | `docs/legal/procedure-droits-personnes.md` | Gabarit |

Puis : liens dans l’app + acceptation tracée (P0-11, P0-12).

---

## Phase C — Correctifs P0 (bloquant exposition)

### C.1 — Fermer les portes exploitables

| ID | Correctif | Effort | Cibles | Réf. |
|----|-----------|--------|--------|------|
| P0-1 | ACL `canViewOrder` sur `/api/messages` (404 si refus) | S | `messages.js` | ASVS V8.2.2 |
| P0-2 | Uploads : MIME réel + UUID + fin du static public `/uploads` | M | users/stores/products, `app.js` | ASVS V5.2–5.3 |
| P0-3 | Politique MDP serveur (≥ 8, cible 12–15, sans composition) | S | `auth.js` | ASVS V6.2.1 |
| P0-4 | `jwt.verify(..., { algorithms: ['HS256'] })` × 3 | S | auth, adminAuth, socket | ASVS V9.1.2 |
| P0-5 | Inscription publique `client` only | S | `auth.js` | ASVS V8 |
| P0-5a | **Limites de longueur serveur sur TOUS les champs texte** (inventaire 08 §2) | M | schémas + routes écriture | 08 · S-06 |
| P0-5b | Filtrer statut sur `GET /api/events/:id` et `/journal` | S | `events.js` | S-11 |
| P0-5c | Refuser MDP / admin par défaut si `NODE_ENV=production` | S | `create-admin` / boot | S-04 · C-15 |

### C.2 — Comptes vivables

| ID | Correctif | Effort | Cibles | Réf. |
|----|-----------|--------|--------|------|
| P0-6 | Changement de mot de passe | M | `users.js` | ASVS V6.2.2 |
| P0-7 | Révocation de session (logout, change pwd, delete) | L | sessions / denylist | ASVS V7.4 |
| P0-8 | Reset MDP + verify email (**dépend A5**) | L | auth + email | ASVS V6.4.1 |
| P0-9 | `DELETE /api/users/me` + anonymisation journaux | L | users + organes | RGPD art. 17 |
| P0-10 | `GET /api/users/me/export` | M | `users.js` | RGPD art. 20 |

### C.3 — Information et déploiement

| ID | Correctif | Effort | Cibles | Réf. |
|----|-----------|--------|--------|------|
| P0-11 | Info + acceptation tracée à l’inscription | M | Register, `consents` | RGPD 13 / 7 |
| P0-12 | Liens légaux accessibles | S | mobile (+ web si gardé) | LCEN |
| P0-13 | TLS 1.2/1.3 + WSS | M | infra / runbook | ASVS V12 / V4.4 |

---

## Phase D — Correctifs P1

### D.1 — Observabilité et données

| ID | Correctif | Effort | Réf. |
|----|-----------|--------|------|
| P1-1 | Journaliser auth succès/échec | S | ASVS V16.3.1 |
| P1-2 | Journaliser refus d’autorisation | S | ASVS V16.3.2 |
| P1-3 | Redact PII dans logs + retirer console socket/lab | S | ASVS V16.2.5 |
| P1-4 | Expédition logs (`ERROR_TRACKING_DSN`) | M | ASVS V16.4.3 |
| P1-5 | JWT + profil → `expo-secure-store` | M | ASVS V14.3.3 · 08 §4 |
| P1-6 | Durées de conservation + purges | L | RGPD 5-1-e |
| P1-7 | Écran Paramètres / Confidentialité | M | RGPD 12 |
| P1-8 | Info RGPD avant OAuth connecteur | M | RGPD 13 |

### D.2 — Validation des entrées (issu de l’inventaire 08)

| ID | Correctif | Effort | Réf. |
|----|-----------|--------|------|
| P1-9 | Schémas déclaratifs (Zod ou équiv.) sur **toutes** les routes d’écriture listées en 08 §6–§7 | L | ASVS V2.2.1 |
| P1-17 | Types / bornes / formats : prix, qty, lat/lng ∈ [-90,90]/[-180,180], dates ISO strictes | M | 08 · S-07 |
| P1-18 | Allowlist domaines `imageUrl()` | S | S-08 |
| P1-19 | Allowlist schémas `Linking.openURL` | S | S-09 |
| P1-20 | Plus de `e.message` brut au client en prod (~12 routes) | M | S-12 |
| P1-21 | Sandbox allowlist env + `requireSandbox` sur World Factory | S | S-13 |
| P1-22 | Valider `next` sur `/auth/callback` | S | S-16 |
| P1-23 | Auth+rôle sur chaque Server Action Next | M | S-17 |
| P1-24 | Strip `console.*` au build prod | S | S-20 |
| P1-25 | Anti-énumération register (ou compromis documenté) | S | S-10 |
| P1-26 | `PUT /api/users/me` : longueurs + formats (aujourd’hui merge aveugle) | S | 08 §6.4 |
| P1-27 | `PATCH /promotions/:id` : revalider `%` 1–99 | S | 08 §6.6 |
| P1-28 | Plafond `quantity` panier / stock + type number strict | S | 08 §6.10 |
| P1-29 | Bornes serveur sur `POST /admin/world/run` params | S | 08 §6.7 |
| P1-30 | Schéma serveur sur params lab actions | M | 08 §6.8 |
| P1-31 | ACL boutique sur `conflicts/:id/acknowledge` | S | 08 §6.9 |
| P1-32 | Idempotency-Key obligatoire aussi sur intents **legacy** (aligner v1) | S | 08 §6.11 |
| P1-33 | `maxLength` UI aligné sur plafonds serveur (support chats, story, CSV UX) | S | 08 §2 |
| P1-34 | Re-scan inventaire 08 à chaque nouveau connecteur / intent / action lab | S | 08 §8 |

### D.3 — Hardening divers

| ID | Correctif | Effort | Réf. |
|----|-----------|--------|------|
| P1-10 | CSP + HSTS (+ Permissions-Policy) si Next exposé | S | ANSSI · ASVS V3 |
| P1-11 | `npm audit` CI + délai de correction écrit | S | ASVS V15 |
| P1-12 | `NSPhotoLibraryUsageDescription` (+ Android) | S | Stores |
| P1-13 | MFA comptes admin | M | ASVS V6.5 |
| P1-14 | (couvert par P0-5c) | — | — |
| P1-15 | Allowlist destinations HTTP moteur intégration | M | SSRF |
| P1-16 | Sauvegarde **restaurée** au moins une fois (preuve datée) | S | Runbook |

---

## Phase E — Durabilité P2

| ID | Action | Réf. |
|----|--------|------|
| P2-1 | Tests auto sur chaque correctif P0/P1 sécu | — |
| P2-2 | Revue annuelle registre + sous-traitants | RGPD 30 |
| P2-3 | AIPD si décision positive | RGPD 35 |
| P2-4 | DSA traçabilité pros + obligations fiscales (conseil) | DSA |
| P2-5 | Rotation secrets / clé coffre | ASVS V13.3.4 |
| P2-6 | `security.txt` | — |
| P2-7 | SBOM + pin SHA Actions CI | OWASP CI/CD |
| P2-8 | **Pentest externe** (couvre ce que la revue de code ne voit pas) | Preuve |
| P2-9 | CSRF tokens + `noopener` | S-19 |
| P2-10 | Blocage capture d’écran écrans sensibles (QR identité) | S-21 |
| P2-11 | Harnais tests mobile (auth + compte) | FD-002 |
| P2-12 | Modèle `order_items` (facturation / conservation) | Dette |

---

## Hors périmètre immédiat (signalé, pas oublié)

- Accessibilité (European Accessibility Act)
- Statut social des livreurs
- Paiement PSP → CGV + PCI-DSS
- Certification ASVS par un tiers

---

## Ordre d’exécution recommandé

```text
Phase 0 (1 jour) → A7/A8 décisions → Vague C.1 → C.2 (email A5) → B corpus
→ C.3 déploiement → Phase D (validation 08 en priorité P1-9 / P1-17 / P1-26…)
→ Phase E dont pentest
```

**Critère « prototype non exposable » :** tout P0 ouvert (phases 0 + C).  
**Critère « défendable » :** tous les P0 + pentest traité + corpus validé avocat + AIPD tranchée (FD-003 §16.7).

---

## Checklist de complétude du plan

- [x] Portes ouvertes (labToken, démo auth, admin defaults, LAN)
- [x] IDOR messages, uploads, MDP, sessions, droits RGPD
- [x] Inventaire champ-par-champ UI mobile (08)
- [x] admin-web + Next + Server Actions
- [x] Body/query API + sockets + webhooks + multer
- [x] Stockage local / tokens
- [x] Lacunes validation serveur croisées UI↔API
- [x] Corpus juridique + gouvernance
- [x] DevOps TLS / backup / CI / logs
- [ ] Runtime pentest (P2-8) — **seule preuve hors revue de code**
- [ ] Re-scan connecteurs futurs (P1-34)
