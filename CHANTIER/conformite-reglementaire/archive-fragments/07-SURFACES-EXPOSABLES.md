# 07 — Surfaces exposables : ce qu'un attaquant peut voir, atteindre et manipuler

| | |
|---|---|
| **Date** | 2026-07-26 |
| **Angle** | Point de vue de l'attaquant, pas du développeur |
| **Périmètre** | `mobile/` (bundle, deep links, entrées) · `admin-web/` · `src/` Next.js legacy · `backend/` (découverte externe) |
| **Méthode** | Revue de code orientée surface d'attaque — **pas** un test d'intrusion |
| **Complète** | [04-AUDIT-SECURITE.md](./04-AUDIT-SECURITE.md) et [06-ASVS-5.0.md](./06-ASVS-5.0.md) |

> Les documents 04 et 06 répondaient à « le code est-il correct ? ».  
> Celui-ci répond à « **que peut faire quelqu'un qui regarde et qui essaie ?** »

Format de chaque écart : **constat → pourquoi c'est vulnérable → ce que fera la nouvelle version → référentiel → gravité**.

---

## 1. Les trois trous critiques découverts par cet angle

Ces trois écarts n'apparaissaient dans aucun audit précédent parce qu'ils ne sont pas des défauts de code : ce sont des **portes ouvertes par conception**.

### S-01 — Injection de session par deep link (`labToken`)

- **Constat :** `mobile/src/context/AppContext.js` L10-18, L119-127, L172-196 et `mobile/src/utils/labToken.js` L10-29. L'application accepte un jeton passé dans une URL : `mazone://lab?labToken=<JWT>` sur mobile, ou `#labToken=<JWT>` dans le fragment d'URL en mode web. Le jeton est validé par un simple appel à `GET /api/users/me` : **tout JWT accepté par cette route ouvre une session complète**. Aucune garde `__DEV__`, aucune vérification que le jeton provient du Laboratoire.
- **Pourquoi c'est vulnérable :** trois scénarios. Un attaquant qui obtient un jeton par n'importe quel moyen (hameçonnage, journal, sauvegarde, capture réseau en HTTP) le transforme en session en un clic. Un lien piégé envoyé à une victime peut la faire basculer dans une session contrôlée par l'attaquant, qui observe ensuite ce qu'elle saisit. Et en mode web, le fragment `#labToken=` reste dans l'historique du navigateur. Le mécanisme est un outil de laboratoire compilé dans le build de production.
- **Ce que fera la nouvelle version :** mécanisme entièrement supprimé du build de production, soit par `__DEV__`, soit par une variable d'environnement de build explicitement absente en production. Si le laboratoire doit continuer à fonctionner, le jeton d'imitation doit être marqué côté serveur (revendication `imp: true`, durée très courte, usage unique) et refusé par un build de production.
- **Référentiel :** ASVS V7.2, V13.4 · OWASP Session Management · CNIL fiche 3
- **Gravité :** **P0 — le plus grave de cet audit**

### S-02 — Mode démonstration : authentification entièrement contournée

- **Constat :** `src/lib/supabase/config.ts` L1-9, `src/lib/supabase/middleware.ts` L11-12, `src/app/(auth)/connexion/page.tsx` L36-39 et L112-120. Si `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont absentes, `updateSession` retourne immédiatement sans vérifier quoi que ce soit, les champs du formulaire ne sont plus obligatoires, et un clic redirige vers l'espace choisi. Le rôle se sélectionne par trois boutons.
- **Pourquoi c'est vulnérable :** ce n'est pas un contournement à trouver, c'est le comportement par défaut. Un déploiement Vercel sans variables d'environnement — ce qui est précisément ce qui arrive quand on déploie « pour voir » — ouvre les espaces commerçant et livreur à n'importe qui, sans mot de passe. Le fichier `vercel.json` est déjà présent et prêt. S'ajoutent des données synthétiques réalistes : noms de clients, adresses parisiennes, revenus livreur (`src/lib/data.ts` L352-456).
- **Ce que fera la nouvelle version :** refus de démarrer en production si la configuration d'authentification est absente, sur le modèle du `fail-fast` déjà en place côté backend dans `config/env.js`. Le mode démonstration doit être une décision explicite (`DEMO_MODE=1`), jamais une conséquence d'une variable oubliée. À défaut, retirer le site legacy du dépôt puisque FD-000 indique qu'il n'est pas le produit.
- **Référentiel :** ASVS V13.4.1, V6.3 · OWASP Security Misconfiguration
- **Gravité :** **P0**

### S-03 — Contrôle de rôle absent malgré l'authentification (Next.js)

- **Constat :** `src/lib/supabase/middleware.ts` L5 et L37-44. Même avec Supabase configuré, le middleware ne vérifie que la **présence** d'une session sur `/commercant` et `/livreur`, jamais le rôle. Le commentaire de la ligne 8 affirme le contraire. La redirection après connexion utilise le rôle choisi dans l'interface (`connexion/page.tsx` L56-57), pas celui du jeton. `getMerchantOrders` (`src/lib/data.ts` L386-391) ne filtre pas par commerçant.
- **Pourquoi c'est vulnérable :** n'importe quel compte client authentifié atteint le tableau de bord commerçant en tapant l'URL, et y voit des commandes qui ne sont pas les siennes.
- **Ce que fera la nouvelle version :** vérification du rôle issu du jeton dans le middleware, et filtrage par propriétaire dans chaque requête de données.
- **Référentiel :** ASVS V8.2.1, V8.2.2
- **Gravité :** P0 si le site est exposé

---

## 2. Ce qui est visible dans le code livré au client

Tout ce qui part dans un bundle est **public par construction**. La question n'est pas « est-ce caché ? » mais « est-ce grave que ce soit lu ? ».

| Élément | Où | Verdict |
|---------|-----|---------|
| `EXPO_PUBLIC_API_URL` | `mobile/src/config.js` L31-32 | Acceptable — révèle l'adresse du backend, ce qui est inévitable |
| `EXPO_PUBLIC_V1_STOCK` | `config.js` L58-68 | Sans risque — drapeau de fonctionnalité |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/config.ts` | Acceptable **si** RLS est correcte — c'est le modèle Supabase |
| `VITE_API_URL`, `VITE_MOBILE_WEB_URL` | `admin-web/src/config.js` | Acceptable |
| Aucune clé serveur, Stripe, Firebase, Maps | — | **Bon point confirmé** |
| `SUPABASE_SERVICE_ROLE_KEY` | Jamais importée côté client | **Bon point confirmé** |
| Source maps en production | Non activées (Next et Vite au défaut) | **Bon point** |
| `public/` | `icon.svg` seulement | Rien à signaler |

### S-04 — Identifiants d'administration écrits dans le bundle

- **Constat :** `admin-web/src/pages/LoginPage.jsx` L5-6 (valeurs par défaut des champs) et L46-48 (texte « Dev local : admin@mazone.local / admin1234 »). Les mêmes valeurs sont les défauts de `backend/scripts/create-admin.js` L7-8 et sont réinitialisées par `start-lab.sh`.
- **Pourquoi c'est vulnérable :** ces identifiants partent dans le JavaScript livré au navigateur. Si la console est servie quelque part — même temporairement, même sur un port oublié — un visiteur lit le mot de passe sans même ouvrir les DevTools, puisqu'il est affiché à l'écran. Et comme le script de création les réutilise, la probabilité qu'un compte réel les porte est élevée.
- **Ce que fera la nouvelle version :** champs vides par défaut, mention retirée, et refus côté serveur d'un mot de passe administrateur par défaut lorsque `NODE_ENV=production`.
- **Référentiel :** ASVS V6.3.2, V13.4 · CNIL fiche 3
- **Gravité :** P0

### S-05 — Serveurs de développement à l'écoute du réseau

- **Constat :** `admin-web/vite.config.js` L6 — `server: { port: 5174, host: true }`. `package.json` L6 — `"dev": "next dev -H 0.0.0.0"`. Le backend écoute `0.0.0.0:4000` hors production.
- **Pourquoi c'est vulnérable :** sur un réseau partagé (café, coworking, salon professionnel, réseau d'entreprise), toute machine du réseau atteint la console d'administration, le site et l'API sans authentification réseau. Combiné à S-04, cela suffit.
- **Ce que fera la nouvelle version :** écoute sur `127.0.0.1` par défaut, exposition réseau uniquement sur variable explicite le temps d'une démonstration.
- **Référentiel :** ASVS V13.4 · CNIL fiche 3
- **Gravité :** P1

---

## 3. Entrées utilisateur — inventaire et défauts

> **Inventaire exhaustif champ par champ :** voir [08-INVENTAIRE-ENTREES.md](./08-INVENTAIRE-ENTREES.md).  
> Ci-dessous : synthèse des écarts (la première version de ce § n’était qu’un résumé).

Environ soixante champs TextInput fixes. **Un seul** impose une limite de longueur : `ChatScreen.js` L180 avec `maxLength={500}`.

### S-06 — Aucune limite de longueur sur les champs de saisie

- **Constat :** tous les champs sauf le chat. Les plus exposés : description et histoire de boutique (`CreateStoreScreen.js` L68-95, multiligne), catalogue CSV collé (`MesIntegrationsScreen.js` L263-272), message d'aide (`HelpCenterScreen.js` L52-58), messages de support (`MerchantSupportChatScreen.js`, `DriverSupportChatScreen.js`).
- **Pourquoi c'est vulnérable :** rien n'empêche d'envoyer un mégaoctet de texte dans un nom de boutique. Le serveur accepte jusqu'à 1 Mo par requête (`app.js` L113-116) et n'impose aucune longueur en base. Répété, cela remplit la base SQLite, dégrade toutes les lectures, et casse l'affichage des autres utilisateurs. C'est un déni de service à coût nul pour l'attaquant.
- **Ce que fera la nouvelle version :** limites côté client pour le confort, et surtout **limites côté serveur** dans les schémas de validation — la seule barrière qui compte, puisque l'attaquant n'utilise pas l'interface.
- **Référentiel :** ASVS V2.2.1, V5.2.1 · OWASP Input Validation
- **Gravité :** P1

### S-07 — Champs numériques et dates en texte libre non validés

- **Constat :** prix et quantités (`AddProductScreen.js` L65-79), pourcentages de remise (`CreatePromotionScreen.js` L87-111), latitude et longitude (`CreateStoreScreen.js` L89-96), et surtout les dates au format `YYYY-MM-DD HH:MM` saisies librement dans `CreatePromotionScreen.js` L111, `PromotionDetailScreen.js` L61, `CreateEventScreen.js` L182 — aucune validation de format côté client ni côté serveur.
- **Pourquoi c'est vulnérable :** un `parseFloat` sur une saisie libre produit `NaN`, qui traverse l'API et se retrouve en base. Une date malformée casse les comparaisons d'expiration : une promotion dont la date de fin est invalide peut ne jamais expirer. Une latitude hors bornes fausse les calculs de distance qui pilotent la diffusion des opportunités.
- **Ce que fera la nouvelle version :** validation de type, de bornes et de format dans les schémas serveur, refus explicite avec message clair, et sélecteurs de date dans l'interface plutôt que de la saisie libre.
- **Référentiel :** ASVS V2.2.1, V2.3 · CNIL fiche 18
- **Gravité :** P1

### S-08 — Chargement d'images depuis n'importe quelle adresse

- **Constat :** `mobile/src/utils/format.js` L25-29 — `imageUrl()` retourne telle quelle toute valeur commençant par `http`. Utilisée dans une quinzaine d'écrans (`HomeScreen`, `StoreDetailScreen`, `Avatar`, `CartScreen`, etc.).
- **Pourquoi c'est vulnérable :** un commerçant, ou quiconque parvient à écrire une URL d'image en base, fait charger une ressource distante par tous les appareils qui affichent la fiche. Cela transmet à un tiers l'adresse IP et l'empreinte de chaque utilisateur qui consulte la page — un traceur invisible que ni Ma Zone ni l'utilisateur n'ont autorisé. C'est un problème de sécurité **et** de conformité, puisqu'un destinataire non déclaré reçoit des données.
- **Ce que fera la nouvelle version :** liste blanche de domaines (le domaine de Ma Zone et les hébergeurs explicitement autorisés), et rejet des autres à l'écriture comme à l'affichage.
- **Référentiel :** ASVS V5.2, V14.1 · RGPD art. 13 (destinataires)
- **Gravité :** P1

### S-09 — Ouverture d'URL externes sans validation de schéma

- **Constat :** `mobile/src/screens/merchant/MesIntegrationsScreen.js` L116 ouvre `authorize_url` renvoyée par le backend sans vérification ; `mobile/src/components/driver/MissionDrawer.js` L24 ouvre des liens de navigation construits localement. Aucun appel à `Linking.canOpenURL` ni contrôle du schéma.
- **Pourquoi c'est vulnérable :** si la réponse du serveur est manipulée, ou si un connecteur futur est moins rigoureux, l'application ouvre une URL arbitraire. En mode web, un schéma `javascript:` s'exécute dans le contexte de la page.
- **Ce que fera la nouvelle version :** n'ouvrir que `https:` (plus les schémas de navigation explicitement autorisés), refuser tout le reste.
- **Référentiel :** ASVS V1.2.2, V50.4 · OWASP Unvalidated Redirects
- **Gravité :** P1

---

## 4. Ce que le backend révèle à qui le sonde

### S-10 — Énumération des comptes à l'inscription

- **Constat :** `backend/src/routes/auth.js` L19-20 — `409 { error: 'Email déjà utilisé' }`. La connexion, elle, est correcte : message unique quelle que soit la cause (L46-48).
- **Pourquoi c'est vulnérable :** un script teste une liste d'adresses et découvre lesquelles ont un compte Ma Zone. Combiné à l'absence de politique de mot de passe, cela cible directement les attaques. La liste obtenue est elle-même une donnée personnelle.
- **Ce que fera la nouvelle version :** réponse indifférenciée avec confirmation par email, ou, si l'ergonomie prime, acceptation documentée du compromis avec limitation de débit renforcée sur cette route.
- **Référentiel :** ASVS V6.3 · OWASP Authentication
- **Gravité :** P1

### S-11 — Initiatives non publiées lisibles par tout compte

- **Constat :** `backend/src/routes/events.js` L288-294 — `GET /api/events/:id` et `/journal` appellent `getEventById` sans filtrer sur le statut et sans `assertCanManage`.
- **Pourquoi c'est vulnérable :** les brouillons d'événements d'un commerçant — une promotion en préparation, une opération commerciale non annoncée — sont lisibles par n'importe quel inscrit qui devine l'identifiant.
- **Ce que fera la nouvelle version :** un brouillon n'est visible que par son propriétaire et par l'équipe de la boutique ; sinon 404.
- **Référentiel :** ASVS V8.2.2
- **Gravité :** P1

### S-12 — Détails d'erreur renvoyés au client en production

- **Constat :** le gestionnaire final est correct (`app.js` L236-241 : message générique en production). Mais une douzaine de routes renvoient `e.message` **avant** de l'atteindre : `admin.js` L29, L54, L163 ; `conversations.js` L25, L37, L54, L62 ; `communication.js` L28, L38, L55, L64 ; `events.js` L26 ; `wallet.js` L21 ; `identity.js` L25 ; et les fonctions `fail()` de `orders.js` L53-60 et `integration.js` L33.
- **Pourquoi c'est vulnérable :** ces messages décrivent la mécanique interne — noms de contraintes, états attendus, règles métier. C'est la cartographie du système offerte à qui sonde.
- **Ce que fera la nouvelle version :** messages métier explicitement rédigés pour l'utilisateur, avec un code d'erreur stable ; le détail technique reste dans les journaux serveur.
- **Référentiel :** ASVS V16.5.1 · OWASP Error Handling
- **Gravité :** P1

### S-13 — Laboratoire actif hors production, garde incomplète

- **Constat :** `backend/src/lib/sandbox.js` L17-22 — le bac à sable est bloqué uniquement si `config.isProduction`. Avec `NODE_ENV=staging`, il est actif dès `SANDBOX_MODE=on`, et actif **par défaut** en développement. Par ailleurs, les routes World Factory (`admin.js` L64-114 : génération et réinitialisation du monde de démonstration) ne passent **pas** par `requireSandbox`, seulement par `verifyAdmin`.
- **Pourquoi c'est vulnérable :** une instance de recette contient souvent des données réelles ou réalistes. Un administrateur compromis y obtient l'imitation d'utilisateurs, et peut réinitialiser le monde de démonstration même sans bac à sable actif.
- **Ce que fera la nouvelle version :** liste blanche d'environnements où le bac à sable est autorisé (développement uniquement, par défaut), et `requireSandbox` étendu à toutes les routes destructrices de World Factory.
- **Référentiel :** ASVS V13.4.1
- **Gravité :** P1

### S-14 — Connexion administrateur sans limitation de débit dédiée

- **Constat :** `backend/src/app.js` L185 — le limiteur strict (10 requêtes par minute) est monté sur `/api/auth` uniquement. `POST /api/admin/auth/login` ne bénéficie que du limiteur global (300 par minute).
- **Pourquoi c'est vulnérable :** trois cents essais de mot de passe par minute sur le compte le plus privilégié du système, dont le nom d'utilisateur par défaut est public (S-04).
- **Ce que fera la nouvelle version :** même limiteur strict sur la connexion administrateur, avec verrouillage progressif.
- **Référentiel :** ASVS V6.3.1
- **Gravité :** P0 — l'effort est de deux lignes

---

## 5. Rendu de contenu et navigateur

### S-15 — Injection HTML dans les marqueurs de carte

- **Constat :** `src/components/ui/LiveMap.tsx` L31-45 — la fonction `storeIcon()` construit du HTML par concaténation et y insère `label` sans échappement. Les appelants passent des noms de boutique : `commande/suivi/page.tsx` L56 et `commande/confirmee/page.tsx` L73.
- **Pourquoi c'est vulnérable :** React échappe automatiquement partout ailleurs, mais Leaflet reçoit ici une chaîne HTML brute. Un nom de boutique contenant une balise devient du code exécuté dans le navigateur de chaque client qui suit sa commande. C'est une faille stockée, déclenchée par une action normale de la victime.
- **Ce que fera la nouvelle version :** échappement du libellé avant insertion, ou construction du marqueur par éléments DOM plutôt que par chaîne.
- **Référentiel :** ASVS V1.2.1 · OWASP XSS Prevention
- **Gravité :** P0 si le site est exposé

### S-16 — Redirection ouverte après authentification

- **Constat :** `src/app/auth/callback/route.ts` L7 et L14 — le paramètre `next` est utilisé comme cible de redirection sans validation.
- **Pourquoi c'est vulnérable :** un lien commençant par le vrai domaine de Ma Zone renvoie la victime vers un site contrôlé par l'attaquant, après une authentification réussie — le moment précis où l'utilisateur est le plus en confiance. C'est le socle d'un hameçonnage crédible.
- **Ce que fera la nouvelle version :** n'accepter que des chemins relatifs commençant par une barre oblique unique, refuser tout ce qui contient un schéma ou une double barre.
- **Référentiel :** ASVS V1.2.2 · OWASP Unvalidated Redirects
- **Gravité :** P1

### S-17 — Actions serveur Next.js sans authentification

- **Constat :** `src/app/(consumer)/commande/actions.ts` L7-24 (`placeOrder`) et `src/app/(driver)/livreur/actions.ts` L5-31 (`acceptMission`, `setDriverOnline`) — aucune vérification d'authentification en mode démonstration ; `updateStockItem` (`(merchant)/commercant/actions.ts` L6-23) ne vérifie pas le rôle.
- **Pourquoi c'est vulnérable :** les actions serveur sont des points d'entrée HTTP réels, appelables directement sans passer par l'interface. Elles écrivent des données.
- **Ce que fera la nouvelle version :** vérification systématique de la session et du rôle en tête de chaque action, sans exception pour le mode démonstration.
- **Référentiel :** ASVS V8.2.1
- **Gravité :** P1

### S-18 — En-têtes navigateur incomplets et cookies non durcis

- **Constat :** `next.config.ts` L8-18 fournit `nosniff`, `Referrer-Policy` et `X-Frame-Options`. Absents : politique de sécurité de contenu, HSTS, `Permissions-Policy`, isolation d'origine. Les cookies Supabase sont laissés aux réglages de la bibliothèque, sans `__Host-` ni `SameSite` explicite. `vercel.json` ne définit aucun en-tête.
- **Pourquoi c'est vulnérable :** sans politique de contenu, l'injection décrite en S-15 s'exécute sans obstacle. Sans HSTS, une première visite en HTTP est interceptable.
- **Ce que fera la nouvelle version :** politique de contenu stricte, HSTS avec préchargement, `Permissions-Policy` fermée par défaut, et attributs de cookies explicites.
- **Référentiel :** ANSSI R2, R14 à R18, R29 à R33 · ASVS V3.3, V3.4
- **Gravité :** P1

### S-19 — Déconnexion sans protection contre la falsification de requête

- **Constat :** `src/app/auth/signout/route.ts` L4 — `POST` sans jeton anti-falsification. Et `admin-web/src/pages/ExplorerPage.jsx` L97 utilise `window.open` sans `noopener`.
- **Pourquoi c'est vulnérable :** gênant plutôt que grave pour la déconnexion ; pour `window.open`, la page ouverte accède à `window.opener` et peut rediriger l'onglet d'origine.
- **Ce que fera la nouvelle version :** jeton anti-falsification sur les actions changeant l'état, et `noopener,noreferrer` sur toute ouverture externe.
- **Référentiel :** ASVS V3.5 · OWASP CSRF
- **Gravité :** P2

---

## 6. Traces laissées sur l'appareil

### S-20 — Journaux de production contenant des données personnelles

- **Constat :** `mobile/src/context/AppContext.js` L83, L87, L94, L152, L183, L187, L189 — appels `console.log` non protégés par `__DEV__`, dont un affichant le nom et le rôle de l'utilisateur lors d'une session de laboratoire. `SoulErrorBoundary.js` L17 journalise des piles d'appel. Aucun plugin Babel ne supprime ces appels au build.
- **Pourquoi c'est vulnérable :** ces messages restent lisibles dans les journaux système de l'appareil, accessibles par d'autres applications selon la plateforme, et remontent dans les rapports de plantage.
- **Ce que fera la nouvelle version :** suppression des appels `console` au build de production, et passage par un journaliseur qui masque les données personnelles.
- **Référentiel :** ASVS V16.2.5 · CNIL fiche 6
- **Gravité :** P1

### S-21 — Aucune protection contre les captures d'écran

- **Constat :** `secureTextEntry` est bien utilisé sur les mots de passe (`LoginScreen.js` L64, `RegisterScreen.js` L114) et sur les identifiants de connecteur (`MesIntegrationsScreen.js` L395). Mais aucun `FLAG_SECURE` Android, aucun `expo-screen-capture`, aucun floutage lors du passage en arrière-plan. Le code QR d'identité (`IdentityScreen.js` L87-92) s'affiche en clair.
- **Pourquoi c'est vulnérable :** le code QR d'identité est un jeton de présentation. Capturé pendant sa durée de validité, il est rejouable. L'aperçu d'application dans le sélecteur de tâches expose aussi les adresses et conversations.
- **Ce que fera la nouvelle version :** blocage de la capture sur les écrans sensibles, et floutage à la mise en arrière-plan.
- **Référentiel :** ASVS V14.3 · OWASP Mobile
- **Gravité :** P2

---

## 7. Ce qui est confirmé sain

À dire aussi clairement que les écarts, parce que cela oriente les efforts.

| Vérification | Résultat |
|--------------|----------|
| `WebView`, `dangerouslySetInnerHTML`, `eval` côté mobile | **Aucun** |
| Secrets serveur embarqués dans le mobile | **Aucun** |
| `SUPABASE_SERVICE_ROLE_KEY` côté client | **Jamais importée** |
| Source maps en production | Désactivées par défaut (Next et Vite) |
| Listing de répertoire sur `/uploads` | Impossible (`express.static` sans `serve-index`) |
| Base SQLite et `.dev-secrets.json` servis par Express | Non — hors du dossier statique |
| OpenAPI ou Swagger exposé par une route | Non |
| Stack d'exécution dans une réponse HTTP | Jamais, même en développement |
| Distinction « email inconnu » / « mot de passe faux » à la connexion | Non — message unique |
| Salons temps réel rejoignables sans droit | Non — `canViewOrder` et `canAccessConversation` vérifiés |
| Signature des webhooks entrants | HMAC à comparaison en temps constant, rejet 401 |
| Rejeu de webhook | Bloqué par clé d'idempotence unique |
| Taille maximale des requêtes | 1 Mo |
| `X-Powered-By` | Masqué par helmet |
| `target="_blank"` sans `noopener` en HTML | Aucune occurrence |

---

## 8. Récapitulatif

| ID | Écart | Surface | Gravité |
|----|-------|---------|---------|
| S-01 | Injection de session par `labToken` | Mobile | **P0** |
| S-02 | Authentification contournée en mode démonstration | Next.js | **P0** |
| S-03 | Rôle non vérifié malgré la session | Next.js | **P0** |
| S-04 | Identifiants d'administration dans le bundle | admin-web | **P0** |
| S-14 | Connexion administrateur sans limitation dédiée | Backend | **P0** |
| S-15 | Injection HTML dans les marqueurs de carte | Next.js | **P0** |
| S-05 | Serveurs de développement ouverts sur le réseau | Tous | P1 |
| S-06 | Aucune limite de longueur de saisie | Mobile + API | P1 |
| S-07 | Nombres et dates non validés | Mobile + API | P1 |
| S-08 | Images chargées depuis n'importe quelle adresse | Mobile | P1 |
| S-09 | Ouverture d'URL sans validation de schéma | Mobile | P1 |
| S-10 | Énumération des comptes à l'inscription | Backend | P1 |
| S-11 | Brouillons d'initiatives lisibles | Backend | P1 |
| S-12 | Détails d'erreur en production | Backend | P1 |
| S-13 | Laboratoire actif hors production | Backend | P1 |
| S-16 | Redirection ouverte après authentification | Next.js | P1 |
| S-17 | Actions serveur sans authentification | Next.js | P1 |
| S-18 | En-têtes et cookies incomplets | Next.js | P1 |
| S-20 | Journaux de production avec données personnelles | Mobile | P1 |
| S-19 | Falsification de requête et `window.opener` | Web | P2 |
| S-21 | Captures d'écran non bloquées | Mobile | P2 |

**Six P0 supplémentaires**, dont trois qui n'étaient visibles que sous cet angle.

---

## 9. La question du site legacy

Trois des six P0 de ce document (S-02, S-03, S-15) concernent `src/`, que FD-000 désigne comme n'étant pas le produit et qu'il ne faut pas développer.

Il n'existe que deux positions défendables, et l'inaction n'en fait pas partie :

- **Le retirer du dépôt.** Le risque disparaît, et avec lui trois P0 et l'entretien associé.
- **Le corriger comme le reste.** Il reste déployable, `vercel.json` est présent, et un déploiement accidentel ouvre les espaces métier à tout visiteur.

Laisser du code déployable et vulnérable dans un dépôt en le déclarant « hors périmètre » ne protège de rien : la protection vient de la suppression ou du correctif, pas de la mention documentaire.

---

## 10. Limites de cet audit

Ce document reste une **revue de code**. N'ont pas été vérifiés, et ne peuvent pas l'être ainsi :

- Le comportement réel d'un bundle Expo compilé et d'un APK décompilé
- L'interception effective du trafic par proxy
- Les vulnérabilités des dépendances tierces elles-mêmes
- Le comportement du déploiement final (proxy inverse, en-têtes réellement émis)

Ces points nécessitent un **test d'intrusion**, qui reste la seule manière de valider les correctifs listés ici.
