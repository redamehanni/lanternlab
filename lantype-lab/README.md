# LANTYP Material Lab

Atelier officiel de creation des materiaux LANTYP.

- Rendu Skia/CanvasKit (meme moteur que l'app mobile)
- Curseurs → apercu instantane
- Presets JSON versionnes dans Git
- Mode Inspect, A/B, Before/After, eclairages, fonds

## Demarrer

```bash
cd lantype-lab
npm install
npm run dev
```

Ouvre [http://localhost:5175](http://localhost:5175).

## Sync vers mobile

```bash
npm run sync:mobile -- glass-v1
```

Copie le preset vers `mobile/src/theme/materials/glass/active.json`.

## Architecture

```
lantype-lab/
  src/materials/     # modules materiaux (verre = premier)
  src/engine/        # CanvasKit Stage
  src/lighting/      # environnements lumineux
  presets/glass/     # JSON versionnes Git
  public/backgrounds/
  server/labServer.ts
```

Le verre est le premier materiau. Metal, bois, eau, fumee… = un nouveau module dans `src/materials/` + une ligne dans le registre.
