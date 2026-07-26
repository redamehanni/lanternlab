/**
 * Types primitifs du CDM.
 *
 * Volontairement peu nombreux : un vocabulaire dont personne ne retient les types
 * ne sert à rien. Chaque type sait dire si une valeur lui correspond, rien de plus.
 */

const TYPES = {
  id: {
    check: (v) => typeof v === 'string' && v.length > 0,
    sqlite: ['TEXT'],
  },
  string: {
    check: (v) => typeof v === 'string',
    sqlite: ['TEXT'],
  },
  text: {
    check: (v) => typeof v === 'string',
    sqlite: ['TEXT'],
  },
  integer: {
    check: (v) => Number.isInteger(v),
    sqlite: ['INTEGER'],
  },
  number: {
    check: (v) => typeof v === 'number' && Number.isFinite(v),
    sqlite: ['REAL', 'NUMERIC', 'INTEGER'],
  },
  money: {
    check: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
    sqlite: ['REAL', 'NUMERIC'],
  },
  // SQLite n'a pas de booléen : 0 / 1 en INTEGER.
  boolean: {
    check: (v) => v === 0 || v === 1 || typeof v === 'boolean',
    sqlite: ['INTEGER'],
  },
  // Horodatages en TEXT ISO, comme partout dans le schéma existant.
  timestamp: {
    check: (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)),
    sqlite: ['TEXT'],
  },
  enum: {
    check: (v, field) => field.values.includes(v),
    sqlite: ['TEXT'],
  },
  json: {
    check: (v) => typeof v === 'string' || (typeof v === 'object' && v !== null),
    sqlite: ['TEXT'],
  },
};

const TYPE_NAMES = Object.keys(TYPES);

module.exports = { TYPES, TYPE_NAMES };
