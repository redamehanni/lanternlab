# Illustrations — bibliothèque d'identité Ma Zone

Les composants UI **ne référencent jamais** un fichier image directement.
Ils passent par le registry : `getIllustration('portes.lanternes')`.

## Ajouter une illustration officielle

1. Déposer le fichier dans le dossier thématique (`portes/`, `banner/`, `murmures/`, `nav/`, `header/`).
2. Mettre à jour `mobile/src/illustrations/registry.js` : `source` + `placeholder: false`.
3. Aucun refactor des composants nécessaires.

## Masque coup de pinceau

`masks/brush-edge.png` — masque alpha réutilisable.
Sur `Illustration`, passer `brushEdge` pour découper les bords en aquarelle
(utilisé sur les portes d'entrée).

Les assets actuels marqués `placeholder: true` sont des approximations pastel
alignées sur la Direction Artistique. Ils seront remplacés progressivement
par la bibliothèque officielle aquarelle.

## Clés actuelles

- `banner.quartier` / `banner.quartierSoft`
- `portes.lanternes` · `evenements` · `participer` · `quartier` · `adresses` · `surprise`
- `murmures.default`
- `header.mailbox`
- `nav.accueil` · `messages` · `wallet` · `panier`
