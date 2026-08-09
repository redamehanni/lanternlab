# Journal des modifications — Portes V1 (accès public)

| | |
|---|---|
| **Date** | 2026-08-04 |
| **Référence** | Plan validé *Portes surface seal* + `AUDIT_COMPATIBILITE_PORTES_OPTION_3.md` |
| **GO** | Reda — implémentation surface-only |

---

## Principe respecté

Les Portes = présentation + contrôle d'accès public. Aucun moteur, API, organe ou modèle de données modifié.

---

## Fichiers modifiés

| Fichier | Raison |
|---|---|
| [`mobile/src/data/deuxiemeAme.js`](../../mobile/src/data/deuxiemeAme.js) | Ajout `status: 'open' \| 'sealed'`, `sealedLabel` / `sealedHint`, helpers `isPorteOpen`, `porteByRoute`, `openPortesCount`. Commentaire de principe. `INTENT_SUGGESTIONS` inchangées en données ; le refus de navigation est côté Accueil. |
| [`mobile/src/components/deuxiemeAme/PorteCard.js`](../../mobile/src/components/deuxiemeAme/PorteCard.js) | Rendu mystère si sealed (cadenas, label scellé, pas de description métier ni d'illustration révélatrice). |
| [`mobile/src/screens/deuxiemeAme/DeuxiemeAmeHomeScreen.js`](../../mobile/src/screens/deuxiemeAme/DeuxiemeAmeHomeScreen.js) | `openPorte` refuse sealed (toast intrigue) ; suggestions IA alignées ; copy « 6 Portes · 1 ouverte » ; hero `showEvents: false`. **Murmurs non filtrés.** |
| [`mobile/src/components/deuxiemeAme/WeatherHero.js`](../../mobile/src/components/deuxiemeAme/WeatherHero.js) | Affiche le pill « événements » seulement si `stats.showEvents !== false` — pour ne pas trahir une Porte scellée depuis le hero. |

## Fichiers créés

| Fichier | Raison |
|---|---|
| [`FICHE_DISCUSSION/FD-004-portes-couche-presentation-acces-public-v1.md`](../../FICHE_DISCUSSION/FD-004-portes-couche-presentation-acces-public-v1.md) | Acter le principe et le périmètre public V1 |
| [`CHANTIER/portes-v1/JOURNAL_MODIFICATIONS.md`](./JOURNAL_MODIFICATIONS.md) | Ce journal |
| [`FICHE_DISCUSSION/INDEX.md`](../../FICHE_DISCUSSION/INDEX.md) | Entrée FD-004 (modifié) |

## Fichiers volontairement non touchés

- Tout le `backend/`
- Event Engine, Wallet, Identity
- Stack navigator (écrans scellés restent enregistrés)
- Première Âme, Épée
- `MurmursScreen` / API murmures (aucun filtre Porte)

---

## Comment rouvrir une Porte plus tard

Dans `mobile/src/data/deuxiemeAme.js`, sur l'entrée concernée :

1. `status: PORTE_STATUS.OPEN`
2. (optionnel) retirer ou ignorer `sealedLabel` / `sealedHint` — le rendu utilise alors `label` / `description`
3. Si c'était la Porte Événements : repasser `showEvents: true` (ou retirer le flag) dans `DeuxiemeAmeHomeScreen` lors du calcul des stats

Aucune migration backend.

---

## Améliorations signalées (hors périmètre — non implémentées)

1. **Deep links / navigation programmatique** vers `Events`, `Participer`, etc. depuis d'autres écrans : le sceau ne porte aujourd'hui que sur Accueil + suggestions IA. Un garde centralisé au niveau du navigator serait une couche supplémentaire — à décider produit.
2. **Override Lab** pour tester les Portes scellées depuis le Bac à Sable : non demandé.
3. **Textes / illustrations mystère** affinés par direction artistique : placeholders narratifs livrés ; revue UI produit possible ensuite.
