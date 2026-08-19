/**
 * Validation légère des Definitions / Events (E0 — sans dépendance Zod).
 * Fail-fast sur structures invalides ; catalogues ouverts pour types inconnus
 * (warn, pas crash runtime — géré côté eval).
 */

const { ENGINE_SCHEMA_VERSION, MATCH_POLICIES, OCCURRENCE_KINDS, MISS_POLICIES } = require('./types');

function isObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function fail(path, msg) {
  const err = new Error(`${path}: ${msg}`);
  err.code = 'LANTERN_SCHEMA_INVALID';
  err.path = path;
  throw err;
}

function assertString(path, v, { optional = false } = {}) {
  if (v == null || v === '') {
    if (optional) return;
    fail(path, 'string requis');
  }
  if (typeof v !== 'string') fail(path, 'doit être une string');
}

function assertNumber(path, v, { optional = false } = {}) {
  if (v == null) {
    if (optional) return;
    fail(path, 'number requis');
  }
  if (typeof v !== 'number' || Number.isNaN(v)) fail(path, 'doit être un number');
}

function assertArray(path, v) {
  if (!Array.isArray(v)) fail(path, 'array requis');
}

function validateConditionExpr(expr, path = 'condition') {
  if (!isObject(expr)) fail(path, 'objet requis');
  if (expr.op === 'true') return;
  if (expr.op === 'and' || expr.op === 'or') {
    assertArray(`${path}.children`, expr.children);
    expr.children.forEach((c, i) => validateConditionExpr(c, `${path}.children[${i}]`));
    return;
  }
  if (expr.op === 'not') {
    validateConditionExpr(expr.child, `${path}.child`);
    return;
  }
  // Predicate feuille
  assertString(`${path}.type`, expr.type);
}

function validateAction(action, path) {
  if (!isObject(action)) fail(path, 'objet requis');
  assertString(`${path}.id`, action.id);
  assertString(`${path}.type`, action.type);
  if (action.params != null && !isObject(action.params)) fail(`${path}.params`, 'objet requis');
  if (action.delayMs != null) assertNumber(`${path}.delayMs`, action.delayMs);
}

function validateOccurrence(occ, path) {
  if (!isObject(occ)) fail(path, 'objet requis');
  if (!Object.values(OCCURRENCE_KINDS).includes(occ.kind)) {
    fail(path, `kind invalide: ${occ.kind}`);
  }
  if (occ.missPolicy != null && !Object.values(MISS_POLICIES).includes(occ.missPolicy)) {
    fail(`${path}.missPolicy`, `invalide: ${occ.missPolicy}`);
  }
}

function validateRule(rule, path) {
  if (!isObject(rule)) fail(path, 'objet requis');
  assertString(`${path}.id`, rule.id);
  assertString(`${path}.title`, rule.title, { optional: true });
  if (typeof rule.enabled !== 'boolean') fail(`${path}.enabled`, 'boolean requis');
  assertNumber(`${path}.priority`, rule.priority);
  assertArray(`${path}.listen`, rule.listen);
  rule.listen.forEach((t, i) => assertString(`${path}.listen[${i}]`, t));
  validateConditionExpr(rule.condition, `${path}.condition`);
  assertArray(`${path}.actions`, rule.actions);
  rule.actions.forEach((a, i) => validateAction(a, `${path}.actions[${i}]`));
  validateOccurrence(rule.occurrence || { kind: 'always' }, `${path}.occurrence`);
  if (rule.matchPolicy != null && !Object.values(MATCH_POLICIES).includes(rule.matchPolicy)) {
    fail(`${path}.matchPolicy`, `invalide: ${rule.matchPolicy}`);
  }
}

function validateVariable(v, path) {
  assertString(`${path}.id`, v.id);
  const types = ['boolean', 'number', 'string', 'enum'];
  if (!types.includes(v.valueType)) fail(`${path}.valueType`, 'type invalide');
  const scopes = ['player', 'team', 'run'];
  if (!scopes.includes(v.scope)) fail(`${path}.scope`, 'scope invalide');
}

function validateZone(z, path) {
  assertString(`${path}.id`, z.id);
  if (!['circle', 'polygon', 'arrondissement'].includes(z.kind)) {
    fail(`${path}.kind`, 'kind invalide');
  }
  if (z.kind === 'circle') {
    if (!isObject(z.center)) fail(`${path}.center`, 'requis');
    assertNumber(`${path}.center.lat`, z.center.lat);
    assertNumber(`${path}.center.lng`, z.center.lng);
    assertNumber(`${path}.radiusM`, z.radiusM);
  }
  if (z.kind === 'arrondissement') {
    const code = z.code ?? z.arrondissement;
    assertNumber(`${path}.code`, Number(code));
  }
}

/**
 * Valide une LanternDefinition E0 (subset).
 * @returns {{ ok: true, definition } | never}
 */
function validateDefinition(definition) {
  if (!isObject(definition)) fail('definition', 'objet requis');
  assertString('id', definition.id);
  assertNumber('engineSchemaVersion', definition.engineSchemaVersion);
  if (definition.engineSchemaVersion > ENGINE_SCHEMA_VERSION) {
    fail('engineSchemaVersion', `non supporté (max ${ENGINE_SCHEMA_VERSION})`);
  }
  assertArray('rules', definition.rules);
  definition.rules.forEach((r, i) => validateRule(r, `rules[${i}]`));

  if (definition.variables) {
    assertArray('variables', definition.variables);
    definition.variables.forEach((v, i) => validateVariable(v, `variables[${i}]`));
  }
  if (definition.zones) {
    assertArray('zones', definition.zones);
    definition.zones.forEach((z, i) => validateZone(z, `zones[${i}]`));
  }
  if (definition.mediaItems) {
    assertArray('mediaItems', definition.mediaItems);
    definition.mediaItems.forEach((m, i) => assertString(`mediaItems[${i}].id`, m.id));
  }

  const ids = new Set();
  for (const r of definition.rules) {
    if (ids.has(r.id)) fail('rules', `id dupliqué: ${r.id}`);
    ids.add(r.id);
  }

  return { ok: true, definition };
}

function validateEvent(event) {
  if (!isObject(event)) fail('event', 'objet requis');
  assertString('type', event.type);
  if (event.clientEventId != null) assertString('clientEventId', event.clientEventId);
  if (event.payload != null && !isObject(event.payload)) fail('payload', 'objet requis');
  return { ok: true, event };
}

module.exports = {
  validateDefinition,
  validateEvent,
  validateConditionExpr,
  ENGINE_SCHEMA_VERSION,
};
