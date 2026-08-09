/**
 * Plugin Vite de developpement : donne au labo un vrai acces disque.
 *
 * Les presets sont des fichiers JSON versionnes dans Git, pas du stockage
 * navigateur. Le labo est la source officielle des materiaux LANTYP, donc
 * l'historique des materiaux doit vivre dans l'historique du projet.
 *
 * Routes (developpement uniquement) :
 *   GET    /__lab/presets/:material            liste
 *   PUT    /__lab/presets/:material/:id        enregistre
 *   DELETE /__lab/presets/:material/:id        supprime
 *   GET    /__lab/backgrounds                  liste des fonds
 *   POST   /__lab/backgrounds/:name            depose un fond
 */
import { Buffer } from 'node:buffer';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { extname, resolve } from 'node:path';
import type { Connect, Plugin } from 'vite';

const PRESETS_DIR = resolve(process.cwd(), 'presets');
const BACKGROUNDS_DIR = resolve(process.cwd(), 'public/backgrounds');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

/** Empeche toute evasion hors des dossiers du labo. */
function safeSegment(value: string): string | null {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  if (!clean || clean.startsWith('.') || clean.includes('..')) return null;
  return clean;
}

function json(res: Parameters<Connect.NextHandleFunction>[1], status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req: Parameters<Connect.NextHandleFunction>[0]): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolvePromise(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Serialisation a cles ordonnees : deux presets identiques produisent le meme
 * texte, donc les diffs Git restent lisibles.
 */
function stableStringify(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.keys(input as Record<string, unknown>)
          .sort()
          .map((key) => [key, sort((input as Record<string, unknown>)[key])]),
      );
    }
    return input;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

function listPresets(material: string) {
  const dir = resolve(PRESETS_DIR, material);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      try {
        return JSON.parse(readFileSync(resolve(dir, file), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function labServer(): Plugin {
  return {
    name: 'lantype-lab-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__lab', async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://lab.local');
        const parts = url.pathname.split('/').filter(Boolean);
        const method = req.method ?? 'GET';

        try {
          // ── Presets ────────────────────────────────────────────────────────
          if (parts[0] === 'presets') {
            const material = safeSegment(parts[1] ?? '');
            if (!material) return json(res, 400, { error: 'material invalide' });

            if (method === 'GET' && parts.length === 2) {
              return json(res, 200, { presets: listPresets(material) });
            }

            const id = safeSegment(parts[2] ?? '');
            if (!id) return json(res, 400, { error: 'id invalide' });
            const dir = resolve(PRESETS_DIR, material);
            const file = resolve(dir, `${id}.json`);

            if (method === 'PUT') {
              const raw = await readBody(req);
              const preset = JSON.parse(raw.toString('utf-8'));
              mkdirSync(dir, { recursive: true });
              writeFileSync(file, stableStringify(preset), 'utf-8');
              return json(res, 200, { ok: true, id });
            }

            if (method === 'DELETE') {
              if (existsSync(file)) rmSync(file);
              return json(res, 200, { ok: true, id });
            }
          }

          // ── Fonds de test ──────────────────────────────────────────────────
          if (parts[0] === 'backgrounds') {
            if (method === 'GET' && parts.length === 1) {
              if (!existsSync(BACKGROUNDS_DIR)) return json(res, 200, { backgrounds: [] });
              const files = readdirSync(BACKGROUNDS_DIR)
                .filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
                .sort();
              return json(res, 200, { backgrounds: files });
            }

            if (method === 'POST' && parts.length === 2) {
              const name = safeSegment(parts[1] ?? '');
              if (!name || !IMAGE_EXTENSIONS.has(extname(name).toLowerCase())) {
                return json(res, 400, { error: 'nom de fichier image invalide' });
              }
              const raw = await readBody(req);
              mkdirSync(BACKGROUNDS_DIR, { recursive: true });
              writeFileSync(resolve(BACKGROUNDS_DIR, name), raw);
              return json(res, 200, { ok: true, name });
            }
          }

          return next();
        } catch (error) {
          return json(res, 500, { error: (error as Error).message });
        }
      });
    },
  };
}
