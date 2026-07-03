# Ma Zone

**Pourquoi attendre demain ce qui est déjà dans votre zone ?**

Plateforme de livraison locale en moins d'une heure.

---

## MVP mobile (React Native + Node.js) — à utiliser maintenant

Pour tester l'application fonctionnelle en local sur votre Mac :

👉 **[GUIDE-DEBUTANT.md](./GUIDE-DEBUTANT.md)** — guide complet pas à pas (installation, 2 terminaux, simulateurs, scénario de démo).

Résumé ultra-court :

```bash
# Terminal 1
cd backend && node src/index.js

# Terminal 2
cd mobile && npx expo start --clear
# Puis appuyer sur "i" pour ouvrir le simulateur iPhone
```

---

## Ancienne version web (Next.js)

L'ancienne maquette web Next.js reste dans ce dépôt. Stack :

- **Next.js 15** (App Router, Server Components, Server Actions)
- **Supabase** (PostgreSQL, Auth multi-rôles, Realtime) — optionnel en développement
- **Leaflet** + tuiles CARTO pour les cartes réelles
- **Tailwind CSS v4** avec un design system dédié (bleu profond, vert disponibilité)

## Mode démonstration vs production

L'application fonctionne **sans configuration** : si les variables Supabase ne sont pas
renseignées, elle bascule automatiquement sur un jeu de données de démonstration (zone
pilote Paris 1er–4e). Dès que Supabase est configuré, les mêmes écrans utilisent la base
de données réelle, l'authentification et le temps réel.

## Démarrage local

```bash
npm install
cp .env.example .env.local   # facultatif : laisser vide pour le mode démonstration
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Configurer Supabase (production)

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans l'éditeur SQL, exécuter dans l'ordre :
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — schéma, RLS, triggers
   - [`supabase/seed.sql`](supabase/seed.sql) — commerces et catalogue de la zone pilote
3. Renseigner `.env.local` :

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXT_PUBLIC_APP_URL=https://votre-domaine.fr
   ```

## Déploiement Vercel

1. Pousser le dépôt sur GitHub.
2. Importer le projet dans Vercel (détection Next.js automatique).
3. Ajouter les variables d'environnement ci-dessus dans les réglages du projet.
4. Déployer. Le build est validé par `npm run build`.

## Parcours couverts

| Rôle | Écrans |
|------|--------|
| Consommateur | Accueil, recherche par temps de livraison, carte, fiche produit dynamique, choix du mode, confirmation, suivi temps réel |
| Commerçant | Dashboard commandes (Realtime), gestion des stocks |
| Livreur | Carte Leaflet, statut en ligne/hors ligne, missions (accepter/refuser), revenus, messages, menu |

## Architecture des données

```
src/lib/
  data.ts          → couche d'accès unique (Supabase ou démonstration)
  demo-data.ts     → catalogue de démonstration (Paris)
  geo.ts           → distances et estimation du temps de livraison
  supabase/        → clients navigateur et serveur, middleware de session
```

## Roadmap post-lancement

- Paiement Stripe intégré au flux de commande
- Calcul d'itinéraire réel (OSRM) et suivi GPS du livreur
- Notifications push
- Tests E2E (Playwright) sur le parcours principal
