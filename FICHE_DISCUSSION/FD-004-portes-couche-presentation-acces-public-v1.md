# FD-004 — Portes : couche de présentation et d'accès public (V1)

| | |
|---|---|
| **Statut** | **brouillon** — rédigée Cursor Reda après GO produit 04/08/2026 |
| **Date** | 2026-08-04 |
| **Auteur(s)** | Reda Mehanni (via Cursor Reda) — validation Adam recommandée |
| **Phase / chantier** | Deuxième Âme — accès public V1 (Portes scellées) |
| **Références** | [FD-000](./FD-000-mise-a-niveau-global-cursor-adam-ma-zone.md) · `AUDIT_COMPATIBILITE_PORTES_OPTION_3.md` · plan *Portes surface seal* |

> **Ne pas contredire FD-000** sur la philosophie produit. Cette fiche **complète** le périmètre public V1 des Portes sans changer les organes.

---

## 1. Contexte

Le lancement public ne doit montrer qu'**une** entrée dans le programme : **Les Lanternes**. Les cinq autres Portes de la grille Accueil restent visibles pour faire comprendre que le projet est plus vaste — sans révéler leur contenu.

## 2. Principe architectural (opposable)

> **Les Portes sont un mécanisme de présentation et d'accès public. Elles ne définissent pas l'architecture interne de l'application.**

Conséquences :

- Event Engine, Wallet, Identity, APIs, modèles de données : **inchangés**
- Les Murmurs sont un **canal** : ils ne connaissent pas les Portes ; leur contenu suit les données réelles
- Ouvrir une Porte plus tard = `status: 'open'` dans le registre surface — **pas** de migration d'organe

## 3. État public V1

| Porte (id interne) | Accès public |
|---|---|
| `lanternes` | **open** |
| `evenements`, `participer`, `quartier`, `adresses`, `surprise` | **sealed** |

Les écrans et routes internes des Portes scellées **restent enregistrés** dans le navigateur (code vivant, Lab, ouverture future).

## 4. Périmètre livré (code)

Fichiers modifiés uniquement (surface mobile) :

- `mobile/src/data/deuxiemeAme.js`
- `mobile/src/components/deuxiemeAme/PorteCard.js`
- `mobile/src/screens/deuxiemeAme/DeuxiemeAmeHomeScreen.js`
- `mobile/src/components/deuxiemeAme/WeatherHero.js` (masquer le compteur « événements » tant que la Porte est scellée)

Journal détaillé : `CHANTIER/portes-v1/JOURNAL_MODIFICATIONS.md`

## 5. Hors périmètre (non touché)

Backend · Event Engine · Wallet · Identity · Épée · Première Âme · enregistrement des screens · filtrage des Murmurs

## 6. Décisions actées

| Date | Décision | Par |
|---|---|---|
| 2026-08-04 | Option 3 — grille Accueil conservée, Lanternes seule ouverte | Reda / Adam |
| 2026-08-04 | Murmurs = canal, aucun filtre Porte | Reda / Adam |
| 2026-08-04 | Vocabulaire `open` / `sealed` — pas « Coming Soon » | Reda / Adam |
| 2026-08-04 | GO implémentation surface-only | Reda |

---

*Fiche générée depuis `_TEMPLATE.md` — valider avec Adam avant statut **validé**.*
