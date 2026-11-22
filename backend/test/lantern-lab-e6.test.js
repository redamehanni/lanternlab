/**
 * E6 — Timeline, Carte, Médias, Simulateur Lab
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.LANTERN_LAB_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lantern-e6-'));

const h = require('./helpers/testServer');
const creator = require('../src/lib/lanternEngine/creator');
const simulate = require('../src/lib/lanternEngine/simulate');

const simOpts = () => ({
  headers: { 'X-Lantern-Sim-Key': 'mazone-lantern-sim' },
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

before(async () => {
  await h.startServer();
});

after(async () => {
  await h.stopServer();
  h.cleanup();
  fs.rmSync(process.env.LANTERN_LAB_UPLOAD_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  h.reset();
  simulate.clearAllSessions();
});

describe('E6 projections', () => {
  it('timeline Mira contient l’heure 19:42 et un délai relatif', () => {
    const mira = creator.loadAdventure('lanterne_de_mira');
    const tl = creator.e6.buildTimeline(mira);
    assert.ok(tl.cues.some((c) => c.at === '19:42' || c.label.includes('19:42')));
    assert.ok(tl.cues.some((c) => c.kind === 'relative' || c.family === 'expiry'));
    assert.equal(tl.timezone, 'Europe/Paris');
  });

  it('carte Mira expose cercles GPS, arrondissement et balises', () => {
    const mira = creator.loadAdventure('lanterne_de_mira');
    const map = creator.e6.buildMap(mira);
    assert.ok(map.zones.some((z) => z.id === 'rue_paradis' && z.point));
    assert.ok(map.zones.some((z) => z.kind === 'arrondissement'));
    assert.ok(map.beacons.some((b) => b.channel === 'qr'));
    assert.ok(map.beacons.some((b) => b.channel === 'nfc'));
  });

  it('médias relient objet et contenu', () => {
    const mira = creator.loadAdventure('lanterne_de_mira');
    const media = creator.e6.buildMediaGraph(mira);
    const usb = media.items.find((i) => i.itemId === 'cle_usb');
    assert.ok(usb);
    assert.equal(usb.content.kind, 'text');
    assert.equal(usb.content.hasFile, false);
  });
});

describe('E6 API', () => {
  it('health annonce E6', async () => {
    const { status, body } = await h.api.get('/api/admin/lantern-lab/health', simOpts());
    assert.equal(status, 200);
    assert.match(body.stage, /E6/);
  });

  it('POST /creator/e6/views renvoie timeline + map + media', async () => {
    const mira = creator.loadAdventure('lanterne_de_mira');
    const { status, body } = await h.api.post(
      '/api/admin/lantern-lab/creator/e6/views',
      { adventure: mira },
      simOpts()
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.timeline.cues));
    assert.ok(Array.isArray(body.map.zones));
    assert.ok(Array.isArray(body.media.items));
  });

  it('patch d’une fenêtre horaire écrit dans la situation, pas ailleurs', async () => {
    const adv = creator.loadAdventure('lanterne_de_mira');
    const { body } = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/update',
      {
        adventure: adv,
        kind: 'cue',
        payload: {
          add: 'clock_between',
          situationId: adv.floors[0].situations[0].id,
          start: '17:00',
          end: '17:15',
        },
      },
      simOpts()
    );
    assert.ok(body.adventure);
    const sit = body.adventure.floors[0].situations[0];
    const blob = JSON.stringify(sit);
    assert.ok(blob.includes('clock_between'));
    assert.ok(blob.includes('17:00'));
    assert.ok(body.e6.timeline.cues.some((c) => c.start === '17:00' && c.end === '17:15'));
  });

  it('upload sandbox + liaison contenu, puis lecture fichier', async () => {
    const { baseUrl } = await h.startServer();
    const fd = new FormData();
    fd.append('file', new Blob([PNG], { type: 'image/png' }), 'polaroid.png');
    fd.append('adventureId', 'test_e6');
    fd.append('contentId', 'content_polaroid');
    const up = await fetch(`${baseUrl}/api/admin/lantern-lab/creator/media/upload`, {
      method: 'POST',
      headers: { 'X-Lantern-Sim-Key': 'mazone-lantern-sim' },
      body: fd,
    });
    assert.equal(up.status, 200);
    const stored = await up.json();
    assert.ok(stored.fileId);
    assert.equal(stored.kind, 'image');
    assert.match(stored.uri, /\/creator\/media\/file\//);

    const file = await fetch(
      `${baseUrl}${stored.uri}?simKey=mazone-lantern-sim`
    );
    assert.equal(file.status, 200);
    assert.match(file.headers.get('content-type'), /image\/png/);
    const buf = Buffer.from(await file.arrayBuffer());
    assert.equal(buf.length, PNG.length);

    const adv = creator.loadAdventure('lanterne_de_mira');
    const patched = await h.api.post(
      '/api/admin/lantern-lab/creator/inventory/update',
      {
        adventure: adv,
        kind: 'content',
        payload: {
          id: 'content_polaroid',
          uri: stored.uri,
          mime: stored.mime,
          fileId: stored.fileId,
          originalName: stored.originalName,
        },
      },
      simOpts()
    );
    assert.equal(patched.status, 200);
    const polaroid = patched.body.e6.media.items.find((i) => i.itemId === 'polaroid');
    assert.equal(polaroid.content.hasFile, true);
  });

  it('simulateur Lab compile Mira et évalue côté moteur (Rue de Paradis)', async () => {
    const mira = creator.loadAdventure('lanterne_de_mira');
    const { status, body } = await h.api.post(
      '/api/admin/lantern-lab/creator/adventures/simulate',
      {
        adventure: mira,
        now: '2026-08-09T17:10:00.000Z',
        lat: 48.8742,
        lng: 2.3548,
        event: {
          type: 'geo.heartbeat',
          source: 'lab_sim',
          at: '2026-08-09T17:10:00.000Z',
          payload: {},
        },
      },
      simOpts()
    );
    assert.equal(status, 200);
    assert.ok(body.sessionId);
    assert.ok(Array.isArray(body.steps));
    assert.ok(Array.isArray(body.humanSteps));
    assert.equal(body.steps[0].injected.source, 'lab_sim');
  });

  it('refuse l’upload hors image/audio/vidéo/texte', async () => {
    const { baseUrl } = await h.startServer();
    const fd = new FormData();
    fd.append('file', new Blob(['MZ'], { type: 'application/octet-stream' }), 'x.bin');
    const up = await fetch(`${baseUrl}/api/admin/lantern-lab/creator/media/upload`, {
      method: 'POST',
      headers: { 'X-Lantern-Sim-Key': 'mazone-lantern-sim' },
      body: fd,
    });
    assert.equal(up.status, 400);
  });

  it('UI Lab expose les onglets E6', async () => {
    const { baseUrl } = await h.startServer();
    const res = await fetch(`${baseUrl}/lantern-lab/`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /data-workspace="timeline"/);
    assert.match(html, /data-workspace="map"/);
    assert.match(html, /data-workspace="media"/);
    assert.match(html, /data-workspace="sim"/);
    assert.match(html, /e6\.js/);
  });
});
