# 08 — Inventaire exhaustif des entrées (point de vue hacker)

| | |
|---|---|
| **Date** | 2026-07-26 (complété — 2ᵉ passe) |
| **Question** | L’audit précédent couvrait-il **tout**, champ par champ ? |
| **Réponse** | **Non.** La première passe avait une synthèse mobile (~20 fichiers TextInput) et des écarts représentatifs. Elle **n’avait pas** : l’inventaire ligne à ligne de chaque champ, l’admin-web, les Server Actions Next, chaque `req.body` backend, les sockets, ni le croisement « UI → API → validation serveur ». |

Ce document ferme ce trou. Il est la base factuelle du [plan de mise en sécurité et conformité](./plan-de-mise-en-securite-et-conformite.md).

---

## 0. Ce qui était couvert / ce qui manquait

| Zone | Avant (07) | Maintenant (08) |
|------|------------|-----------------|
| TextInput mobile | Synthèse (« 20 fichiers, 1 seul maxLength ») | **~63 champs** listés un par un |
| Saisies non-texte (photo, QR, steppers, chips) | Partiel | Inventoriées |
| Stockage local mobile | 4 clés mentionnées | Tableau + risque |
| admin-web formulaires | Login + impersonation seulement | Login, World, Explorer Lab **complet** |
| Next.js inputs + Server Actions | Contournement auth + XSS carte | Champs + `placeOrder` / stock / mission |
| Routes backend body/query | Écarts ciblés | Surface d’entrée par famille de routes |
| Socket / webhooks / multer | Partiel | Complet |
| Croisement UI ↔ validation serveur | Absent | §5 lacunes priorisées |

**Limite restante (assumée) :** cet inventaire est une **revue de code**, pas un pentest. Les payloads dynamiques (formulaires connecteurs, params d’intents v1, actions lab) évoluent avec le backend — à re-scanner à chaque nouveau connecteur / intention.

---

## 1. Compteurs

| Surface | Entrées inventoriées |
|---------|---------------------:|
| Champs TextInput mobile (fixes) | ~60 |
| Champs TextInput dynamiques (connecteurs) | N (aujourd’hui 1 connu : Shopify `shop_domain`) |
| Saisies non-texte mobile | ~25 (photos, QR, steppers, chips, deep link) |
| Clés stockage local mobile | 4 |
| Champs admin-web | ~15 + params lab dynamiques |
| Inputs / actions Next.js | ~12 |
| Routes API avec body/query | ~100+ opérations |
| Événements socket client | 7 |
| Upload multer | 3 endpoints |

---

## 2. Mobile — TextInput (champ par champ)

Légende validation serveur : **Oui** = contrôle observable · **Faible** = présence seule / partiel · **Non** = merge aveugle ou absent · **N/A** = pas d’API.

| # | Écran | Champ | maxLength | Validation client | API | Validation serveur |
|---|-------|-------|-----------|-------------------|-----|-------------------|
| 1 | Login | email | — | non vide, trim+lower | `POST /api/auth/login` | Faible |
| 2 | Login | password | — | non vide ; `secureTextEntry` | idem | Faible (pas de politique) |
| 3 | Register | name | — | requis | `POST /api/auth/register` | Faible (présence) |
| 4 | Register | email | — | requis | idem | Faible + énumération 409 |
| 5 | Register | password | — | requis ; placeholder « Min. 6 » **non appliqué** | idem | **Non** (pas de longueur min) |
| 6 | Register | phone | — | optionnel | idem | Non |
| 7 | Register | address (client) | — | optionnel | idem | Non |
| 8–10 | Profile | name, phone, address | — | trim seulement | `PUT /api/users/me` | **Non** |
| 11–14 | ClientInfo | first_name, last_name, phone, address | — | trim | `PUT /api/users/me` | **Non** |
| 15–16 | ClientInfo | label + nouvelle adresse | — | address non vide | `POST /api/users/addresses` | Faible (`address` requis) |
| 17–21 | HelpCenter | prénom, nom, email, sujet, message | — | sujet+message | **aucune API** (Alert locale) | N/A |
| 22 | SearchBar / SearchScreen | query | — | aucune | `GET /api/products/search?q=` | Faible (LIKE) |
| 23 | AiIntentBar | intention | — | trim | toast local | N/A |
| 24–28 | AddProduct | barcode, name, description, price, quantity | — | name+price ; `,`→`.` | `POST/PUT /api/products` | Faible (name+price) |
| 29–36 | CreateStore | name, address, description, story, phone, email, lat, lng | — | name+address | `POST/PUT /api/stores` | Faible |
| 37–41 | CreatePromotion | % , buy/get qty, max, ends_at | — | produit requis ; date **libre** | `POST /api/promotions` | Partiel (% 1–99 à la création) |
| 42–45 | PromotionDetail | %, max, remaining, ends_at | — | aucune | `PATCH /api/promotions/:id` | **Faible** (% non revalidé) |
| 46–51 | CreateEvent | title, summary, startsAt, address, price, capacity | — | title ; price>0 si payant ; date **libre** | `POST /api/events` | Faible (type/title/channels) |
| 52–54 | DiffuseOpportunity | quota, radiusKm, note | — | seuils locaux | `POST …/diffuse` | Partiel (organe) |
| 55 | MesIntegrations | document CSV (multiligne) | — | non vide | `…/import(/inspect)` | Faible (member) |
| 56+ | MesIntegrations | champs connecteur dynamiques | — | `required` UI | `…/connect/:id` | Schéma connecteur |
| 57 | LanternScan | id manuel | — | trim | `POST …/discover` | Organe |
| 58 | Chat | content | **500** | trim | `POST …/messages` | Organe (trim) |
| 59–60 | Support driver / merchant | content | — | trim | support messages | Trim + ownership thread |
| 61–62 | OrderConfirm | label, address | — | address si new | `addAddress` + `POST /api/orders` | Organe orders |

**Seul champ avec `maxLength` UI : chat (500).** Tous les autres : illimités côté client.

---

## 3. Mobile — saisies non-texte

| Type | Où | Donnée | Risque |
|------|-----|--------|--------|
| ImagePicker / caméra | Register, Profile, ClientInfo, CreateStore, AddProduct | fichier → multipart | Upload sans filtre MIME serveur |
| QR scan caméra | LanternScanScreen | id événement | Injection d’id arbitraire (serveur doit refuser) |
| QR affiché | IdentityScreen, EventDetail | token / event id | Capture d’écran (S-21) |
| Steppers stock / panier | ManageStock, Cart | delta / quantity | Pas de plafond client |
| Chips / switches | promotions, Mode Réception, CreateEvent, transport | enums | OK si serveur revalide |
| Deep link `labToken` | AppContext | JWT dans URL | **P0 S-01** |
| Géoloc device | — | **absente** | lat/lng saisis à la main (boutique) |
| Clipboard / DocumentPicker / DateTimePicker | — | **absents** | Dates en texte libre = risque format |

---

## 4. Stockage local

| Clé | Où | Contenu | Chiffré | Gravité |
|-----|-----|---------|---------|---------|
| `token` | AsyncStorage / sessionStorage web | JWT | **Non** | P1 — SecureStore |
| `user` | idem | profil PII complet | **Non** | P1 |
| `activeSoul` | idem | first/second | Non | Faible |
| `driver_online` | idem | 0/1 | Non | Faible |
| `mazone_admin_token` | admin-web localStorage | JWT admin 7j | **Non** | P0 si console exposée |
| Cookies Supabase | Next SSR | session | Librairie | Durcir attributs |

---

## 5. admin-web + Next.js

### admin-web

| Champ / action | Prérempli | Endpoint | Validation serveur |
|----------------|-----------|----------|-------------------|
| email / password login | **Oui** (admin@… / admin1234) | `POST /api/admin/auth/login` | bcrypt ; **pas de rate-limit dédié** |
| World recipe params | defaults UI | `POST /world/run` | recipeId ; **params min/max non bornés serveur** |
| world reset | — | `POST /world/reset` | Admin only ; **pas de sandbox** |
| impersonate / ios | — | POST | Admin+Sandbox+démo |
| Lab actions + params dynamiques | defaults | `POST /lab/actions/:id` | démo ; **schéma params non appliqué serveur** |

### Next.js

| Entrée | Destination | Validation |
|--------|-------------|------------|
| fullName, email, password, rôle UI | Supabase ou bypass démo | Contournement si env absente (**P0**) |
| SearchBar `q` | `/recherche?q=` | Affichage |
| hidden product/store/fulfillment/address | `placeOrder` | **Aucune** |
| stock number + available | `updateStockItem` | **Aucune** + pas de rôle |
| `acceptMission(orderId)` | Server Action | **Aucune** ownership |
| `auth/callback?next=` | redirect | **Open redirect** |
| `LiveMap` label HTML | Leaflet | **XSS** si nom magasin hostile |

---

## 6. Backend — lacunes de validation (priorité hacker)

Ce tableau est le plus important : l’attaquant **n’utilise pas l’UI**.

| # | Surface | Manque | Gravité |
|---|---------|--------|---------|
| 1 | `GET/POST /api/messages` | Pas de `canViewOrder` | **P0** |
| 2 | Multer photo/image | Pas de MIME réel ; `originalname` ; `/uploads` public | **P0** |
| 3 | `POST /api/auth/register` | Pas de longueur MDP ; rôle libre ; énumération email | **P0** |
| 4 | `PUT /api/users/me` | Aucune longueur/format name/phone/address/lat/lng | P1 |
| 5 | `POST/PATCH` events | Body quasi opaque ; pas de bornes longueur | P1 |
| 6 | `PATCH /api/promotions/:id` | `%` non revalidé 1–99 | P1 |
| 7 | `POST /api/admin/world/run` params | min/max recettes non appliqués | P1 |
| 8 | Lab `params` | Schéma UI ignoré côté serveur | P1 |
| 9 | `POST …/conflicts/:id/acknowledge` | Pas de preuve d’appartenance boutique | P1 |
| 10 | Cart `quantity` | Pas de plafond | P1 |
| 11 | Intents legacy | Idempotency-Key optionnelle (v1 OK) | P1 |
| 12 | Dates `ends_at` / `startsAt` | Format libre, pas de parse strict | P1 |
| 13 | Import CSV `document` | Taille/contenu — limite JSON 1 Mo seulement | P1 |
| 14 | Socket `leave:*` | Sans check (faible) | P2 |
| 15 | `/uploads` | Public sans auth | **P0** (lié uploads) |

**Mieux couverts (ne pas re-ouvrir sans preuve) :** `canViewOrder` sur orders + join socket ; webhooks HMAC ; v1 intents + `validateParams` ; inventory ownership ; impersonate sandbox+démo ; helmet ; rate-limit global+auth citoyen.

---

## 7. Payloads API construits côté mobile (référence)

Familles couvertes dans `mobile/src/api/index.js` + `v1.js` :

- Auth : register, login  
- Profil / adresses / stores / products / stock  
- Cart / orders / favorites / promotions  
- Drivers online, missions status, support messages  
- Communication / conversations  
- Events, Mode Réception, diffusion, discover  
- Identity token (+ verify non branché UI)  
- Integration connect / reconcile / import  
- v1 : inventory, intents, orders, stores, integrations  

Tout champ listé §2 doit avoir un **schéma serveur** correspondant (phase C du plan).

---

## 8. Aveugles restants (à traiter comme dette)

1. **Formulaires connecteurs dynamiques** — nouveaux champs sans toucher le mobile → chaque nouveau connecteur = re-scan validation.  
2. **Params d’intents v1** — définis serveur ; pas d’écran de saisie dédié aujourd’hui, mais surface API ouverte.  
3. **Actions lab dynamiques** — même problème côté admin.  
4. **Comportement runtime** (APK décompilé, proxy Burp, bypass client) — hors revue de code → **pentest** (P2-8).  
5. **RLS Supabase réelle** si le legacy est déployé avec Supabase — non testée ici (dépend du projet cloud).

---

## 9. Règle d’or pour le plan

> **Aucune saisie UI n’est une protection.**  
> Chaque ligne des tableaux §2–§5 y compris steppers, chips, deep links, uploads et body API doit être refusée côté serveur si hors contrat.  
> Le correctif transversal est : **schémas de validation déclaratifs sur toutes les routes d’écriture** + limites de longueur + types/bornes — pas des `maxLength` UI seuls.

Voir plan : items **P0-5a**, **P1-9**, **P1-17**, **P1-26** à **P1-32**.
