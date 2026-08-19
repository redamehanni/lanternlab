/**
 * Registre Open/Closed des predicates (feuilles de ConditionExpr).
 */

const time = require('./time');

const handlers = new Map();

function register(type, handler) {
  if (handlers.has(type)) throw new Error(`predicate déjà enregistré: ${type}`);
  handlers.set(type, handler);
}

function get(type) {
  return handlers.get(type) || null;
}

function list() {
  return [...handlers.keys()].sort();
}

function mediaState(ctx, mediaItemId) {
  return ctx.runtime.mediaStates?.[mediaItemId] || {};
}

function getVar(ctx, id) {
  return ctx.runtime.vars?.[id];
}

// ── Catalogue v1 ─────────────────────────────────────────────────────────────

register('media.discovered', (pred, ctx) => {
  return mediaState(ctx, pred.mediaItemId).discovered === true;
});

register('media.consumed', (pred, ctx) => {
  return mediaState(ctx, pred.mediaItemId).consumed === true;
});

register('media.opened', (pred, ctx) => {
  return mediaState(ctx, pred.mediaItemId).opened === true;
});

register('media.unlocked', (pred, ctx) => {
  return mediaState(ctx, pred.mediaItemId).unlocked === true;
});

register('media.visible', (pred, ctx) => {
  return mediaState(ctx, pred.mediaItemId).visible === true;
});

register('step.equals', (pred, ctx) => {
  return Number(ctx.runtime.step) === Number(pred.value);
});

register('step.gte', (pred, ctx) => {
  return Number(ctx.runtime.step) >= Number(pred.value);
});

register('step.lt', (pred, ctx) => {
  return Number(ctx.runtime.step) < Number(pred.value);
});

register('var.equals', (pred, ctx) => {
  return getVar(ctx, pred.varId) === pred.value;
});

register('var.truthy', (pred, ctx) => {
  return Boolean(getVar(ctx, pred.varId));
});

register('var.compare', (pred, ctx) => {
  const left = getVar(ctx, pred.varId);
  const right = pred.value;
  switch (pred.operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return Number(left) > Number(right);
    case 'gte':
      return Number(left) >= Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'lte':
      return Number(left) <= Number(right);
    default:
      return false;
  }
});

register('choice.equals', (pred, ctx) => {
  return ctx.runtime.choices?.[pred.choiceId] === pred.value;
});

register('geo.inZone', (pred, ctx) => {
  return (ctx.resolvedZones || []).includes(pred.zoneId);
});

register('geo.inAnyZone', (pred, ctx) => {
  const ids = pred.zoneIds || [];
  const resolved = ctx.resolvedZones || [];
  return ids.some((id) => resolved.includes(id));
});

register('geo.outsideZone', (pred, ctx) => {
  return !(ctx.resolvedZones || []).includes(pred.zoneId);
});

register('time.inWindow', (pred, ctx) => {
  const tz = pred.timezone || ctx.definition.timezone || 'Europe/Paris';
  return time.isInTimeWindow(ctx.now, pred.start, pred.end, tz);
});

register('time.equalsMinute', (pred, ctx) => {
  const tz = pred.timezone || ctx.definition.timezone || 'Europe/Paris';
  return time.equalsMinute(ctx.now, pred.at, tz);
});

register('beacon.scanned', (pred, ctx) => {
  return (ctx.runtime.beaconsScanned || []).includes(pred.beaconId);
});

register('object.stateEquals', (pred, ctx) => {
  return ctx.runtime.objectStates?.[pred.objectId] === pred.value;
});

register('event.payloadEquals', (pred, ctx) => {
  const val = ctx.event?.payload?.[pred.key];
  return val === pred.value;
});

register('event.typeEquals', (pred, ctx) => {
  return ctx.event?.type === pred.value;
});

register('occurrence.notFired', (pred, ctx) => {
  const led = ctx.runtime.occurrenceLedger?.[pred.ruleId || pred.ledgerKey];
  return !led?.exhausted && !led?.lastFiredAt;
});

module.exports = {
  register,
  get,
  list,
};
