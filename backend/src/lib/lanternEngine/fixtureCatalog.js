/**
 * Catalogue des fixtures Golden / E0b pour le simulateur S1.
 * Données uniquement — aucune logique métier par Lanterne.
 */

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const CATALOG = [
  {
    id: 'magellan',
    file: 'magellan.json',
    title: 'Talkie Magellan (Golden #1)',
    description: '3 branches exclusives X/Y/V selon arrondissement + fenêtre 17h00–17h15',
  },
  {
    id: 'appel20h17',
    file: 'appel20h17.json',
    title: 'Appel 20h17 (Golden #2)',
    description: 'time.schedule absolu · Bureau · once · miss/expire',
  },
  {
    id: 'appel_relatif',
    file: 'appel_relatif.json',
    title: 'Appel relatif +17 min (E0b)',
    description: 'media.consumed note → schedule.after → tickSchedules',
  },
];

function listFixtures() {
  return CATALOG.map(({ id, title, description, file }) => ({
    id,
    title,
    description,
    file,
  }));
}

function loadFixture(fixtureId) {
  const entry = CATALOG.find((f) => f.id === fixtureId);
  if (!entry) {
    const err = new Error(`Fixture inconnue: ${fixtureId}`);
    err.status = 404;
    err.code = 'FIXTURE_NOT_FOUND';
    throw err;
  }
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, entry.file), 'utf8');
  const definition = JSON.parse(raw);
  return { meta: entry, definition };
}

module.exports = { listFixtures, loadFixture, CATALOG, FIXTURES_DIR };
