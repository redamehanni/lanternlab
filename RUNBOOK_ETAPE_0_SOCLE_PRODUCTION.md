# Runbook — Étape 0 : socle de production

| | |
|---|---|
| **Nature** | Runbook opérationnel (accompagne la roadmap) |
| **Date** | 2026-07-25 |
| **Référence** | `ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md` — Étape 0 |
| **Statut** | Livrables code **faits** ; livrables externes **à faire par un humain** |

---

## 1. Ce qui est fait dans le code

| Livrable | Fichier | Comportement |
|----------|---------|--------------|
| Configuration validée au boot | `backend/src/config/env.js` | Point unique. Crash si configuration invalide |
| Secrets obligatoires en production | `backend/src/config/env.js` | `JWT_SECRET` / `ADMIN_JWT_SECRET` absents → `exit(1)` |
| Secrets dev générés et persistés | `backend/data/.dev-secrets.json` | Aléatoires, stables entre redémarrages, gitignorés |
| Secrets historiques bannis | `backend/src/config/env.js` | `mazone-secret-dev-2024` refusé même fourni explicitement |
| CORS allowlist | `backend/src/index.js` | `CORS_ORIGINS` obligatoire en production ; `*` refusé |
| Sandbox verrouillé | `backend/src/lib/sandbox.js` + `config/env.js` | `isSandbox()` retourne toujours `false` en production ; `SANDBOX_MODE=on` + production → crash |
| helmet | `backend/src/index.js` | HSTS, `nosniff`, `X-Frame-Options` |
| Rate limiting | `backend/src/index.js` | 300 req/min global, **10 req/min sur `/api/auth`** en production |
| Logs structurés | `backend/src/lib/logger.js` | JSON en production, lisible en dev, secrets masqués |
| Gestion d'erreurs | `backend/src/index.js` | 404 JSON + filet final (aucune stack trace au client) |
| Arrêt propre | `backend/src/index.js` | SIGTERM → drain, checkpoint WAL, fermeture base |
| Sauvegarde WAL-safe | `backend/scripts/backup-db.js` | `db.backup()` + `integrity_check` + rétention |
| CI | `.github/workflows/ci.yml` | Tests + contrôle des Lois 1 et 4 + absence de secret en dur |
| Tests | `backend/test/env.test.js` | 11 tests sur les garde-fous de démarrage |

**Vérification locale :**

```bash
cd backend && npm test        # 11 tests doivent passer
npm run backup                # sauvegarde + vérification d'intégrité
npm start                     # démarre en dev, secrets auto-générés
```

> **Note de compatibilité.** Aucun comportement métier n'a changé. Le mobile fonctionne sans modification : les secrets de développement sont désormais persistés, donc les sessions survivent aux redémarrages du backend comme avant.

---

## 2. Ce qui reste à faire — actions humaines

Ces éléments demandent des comptes, des décisions commerciales ou juridiques. Le code ne peut pas les produire.

### 2.1 Hébergement et HTTPS

- [ ] Choisir l'hébergeur (**décision ouverte** — FD-000 §23.2)
- [ ] Volume persistant pour `backend/data/` — **impératif** : SQLite est un fichier, pas un service
- [ ] Reverse proxy avec TLS devant l'application (Caddy, nginx, ou terminaison de l'hébergeur)
- [ ] WSS : le proxy doit relayer l'upgrade WebSocket vers Socket.io
- [ ] Variables d'environnement de production configurées côté hébergeur

Configuration attendue en production :

```
NODE_ENV=production
JWT_SECRET=<48 octets aléatoires>
ADMIN_JWT_SECRET=<48 octets aléatoires, différent>
CORS_ORIGINS=https://admin.mazone.app
TRUST_PROXY_HOPS=1
```

Générer un secret :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> L'application écoute sur `127.0.0.1` en production par défaut : elle n'est joignable qu'à travers le proxy. Pour un hébergeur qui route directement vers le conteneur, forcer `HOST=0.0.0.0`.

### 2.2 Sauvegardes planifiées

- [ ] Cron quotidien : `cd backend && npm run backup`
- [ ] **Copie hors machine** — une sauvegarde sur le même disque que la base ne protège de rien
- [ ] Test de restauration réel une fois, avant le pilote

### 2.3 Observabilité

- [ ] Choisir un error tracker, renseigner `ERROR_TRACKING_DSN`, puis brancher le point d'accroche dans `backend/src/lib/logger.js` (`reportError`)
- [ ] Collecte des logs JSON par l'hébergeur
- [ ] Alerte sur le healthcheck `/health`

### 2.4 Paiement (PSP)

- [ ] Choisir le PSP (**décision ouverte** — Stripe pressenti, FD-000 §23.2)
- [ ] Compte et vérification d'identité
- [ ] Intégration paiement dans le flux commande
- [ ] Un paiement réel de bout en bout en staging

> **Rappel FD-000 :** le Wallet n'est pas un PSP. Les objets numériques et le paiement sont deux organes distincts.

### 2.5 Juridique et commercial

- [ ] CGU / CGV, politique de confidentialité, mentions RGPD
- [ ] Modèle de commission V0 (le dispatch applique aujourd'hui 5 % livreur)
- [ ] Processus de support et de litige
- [ ] Zone pilote choisie (**décision ouverte**)

### 2.6 Distribution

- [ ] Compte Apple Developer, build et soumission iOS
- [ ] Compte Google Play, build et soumission Android (**décision ouverte** : iOS seul ou les deux)
- [ ] URL d'API de production dans la configuration mobile

---

## 3. Critère de sortie de l'Étape 0

L'étape est terminée quand ces quatre affirmations sont vraies **en production** :

1. Démarrer sans `JWT_SECRET` fait crasher le process — **testé automatiquement**
2. `SANDBOX_MODE=on` avec `NODE_ENV=production` est refusé — **testé automatiquement**
3. Un paiement réel passe de bout en bout — **action humaine**
4. La CI est verte sur `main` — **action humaine (premier push)**

**Porte ouverte :** « On peut déployer. »

---

## 4. Dette assumée à cette étape

| Dette | Pourquoi acceptée | Déclencheur de réexamen |
|-------|-------------------|-------------------------|
| SQLite mono-instance | Suffisant pour un pilote ; migrer maintenant coûterait le temps de l'étape 1 | Roadmap E6 : plus de 200 messages Outbox en attente de façon soutenue |
| Pas de Redis adapter Socket.io | Une seule instance, donc pas de problème de rooms partagées | Le jour où deux instances tournent |
| Timers de dispatch en mémoire | Défaut connu (`dispatchOffer.js`) — une offre peut rester bloquée en `offered` après redémarrage | Orchestré en E5, réparé ensuite |
| `products.quantity` compteur unique | Corrigé à l'étape E4 (triple état) | E4 |

---

*Runbook Étape 0 — Cursor Reda — 2026-07-25.*
