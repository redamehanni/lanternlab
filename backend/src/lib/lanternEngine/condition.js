/**
 * Évaluation ConditionExpr (AND / OR / NOT + predicates).
 */

const predicates = require('./predicates');

/**
 * @returns {{ value: boolean, trace: object }}
 */
function evaluateCondition(expr, ctx) {
  if (!expr || typeof expr !== 'object') {
    return { value: false, trace: { op: 'invalid', value: false, reason: 'expr manquant' } };
  }

  if (expr.op === 'true') {
    return { value: true, trace: { op: 'true', value: true } };
  }

  if (expr.op === 'and') {
    const children = [];
    let value = true;
    for (const child of expr.children || []) {
      const r = evaluateCondition(child, ctx);
      children.push(r.trace);
      if (!r.value) {
        value = false;
        // short-circuit mais on continue pour le simulateur/debug narratif
      }
    }
    if ((expr.children || []).length === 0) value = true;
    return { value, trace: { op: 'and', value, children } };
  }

  if (expr.op === 'or') {
    const children = [];
    let value = false;
    for (const child of expr.children || []) {
      const r = evaluateCondition(child, ctx);
      children.push(r.trace);
      if (r.value) value = true;
    }
    if ((expr.children || []).length === 0) value = false;
    return { value, trace: { op: 'or', value, children } };
  }

  if (expr.op === 'not') {
    const r = evaluateCondition(expr.child, ctx);
    return { value: !r.value, trace: { op: 'not', value: !r.value, child: r.trace } };
  }

  // Predicate feuille
  const handler = predicates.get(expr.type);
  if (!handler) {
    return {
      value: false,
      trace: {
        type: expr.type,
        value: false,
        reason: 'predicate_unknown',
        params: summarizePred(expr),
      },
    };
  }
  let value = false;
  let reason;
  try {
    value = Boolean(handler(expr, ctx));
  } catch (err) {
    value = false;
    reason = err.message;
  }
  return {
    value,
    trace: {
      type: expr.type,
      value,
      reason,
      params: summarizePred(expr),
    },
  };
}

function summarizePred(expr) {
  const { type, op, children, child, ...rest } = expr;
  return rest;
}

module.exports = { evaluateCondition };
