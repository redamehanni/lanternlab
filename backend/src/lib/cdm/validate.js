/**
 * CDM — validation de forme.
 *
 * Le CDM ne valide QUE la forme : noms d'attributs, types, obligation, valeurs
 * d'énumération, et interdiction d'écrire un attribut calculé. Il ne valide aucune
 * règle métier : « ce client peut-il commander ce produit » est une décision
 * d'organe, jamais du vocabulaire (Loi 4).
 */

const { ENTITIES } = require('./entities');
const { TYPES } = require('./types');
const ownership = require('./ownership');

class CdmValidationError extends Error {
  constructor(entity, issues) {
    super(`CDM ${entity} : ${issues.join(' ; ')}`);
    this.name = 'CdmValidationError';
    this.entity = entity;
    this.issues = issues;
    this.status = 400;
  }
}

/** Champs déclarés d'une entité, dérivés inclus. */
function fieldsOf(entityName) {
  const entity = ENTITIES[entityName];
  if (!entity) throw new Error(`CDM : entité inconnue « ${entityName} »`);
  return { ...entity.fields, ...(entity.computed || {}) };
}

function checkType(field, value) {
  const type = TYPES[field.type];
  if (!type) return `type CDM inconnu « ${field.type} »`;
  if (!type.check(value, field)) {
    if (field.type === 'enum') {
      return `valeur hors énumération (attendu : ${field.values.join(' | ')})`;
    }
    return `type invalide (attendu ${field.type})`;
  }
  return null;
}

/**
 * Valide un objet contre une entité du CDM.
 *
 * @param {string} entityName
 * @param {object} value
 * @param {{ partial?: boolean, inventoryOwner?: string }} options
 *        `partial: true` pour une mise à jour : les champs obligatoires absents
 *        sont tolérés, mais les champs présents restent contrôlés.
 * @throws {CdmValidationError}
 */
function validate(entityName, value, { partial = false, inventoryOwner } = {}) {
  const entity = ENTITIES[entityName];
  if (!entity) throw new Error(`CDM : entité inconnue « ${entityName} »`);
  if (value === null || typeof value !== 'object') {
    throw new CdmValidationError(entityName, ['objet attendu']);
  }

  const fields = fieldsOf(entityName);
  const issues = [];

  for (const [name, field] of Object.entries(fields)) {
    const present = Object.prototype.hasOwnProperty.call(value, name);

    if (!present) {
      if (field.required && !partial) issues.push(`${name} est obligatoire`);
      continue;
    }

    // Loi 11 : une valeur dérivable n'est jamais une vérité stockable. Tenter
    // d'écrire `available` ou `products.quantity` est une erreur, pas un avertissement.
    if (ownership.isCalculated(entityName, name, { inventoryOwner })) {
      issues.push(`${name} est calculé et ne peut pas être écrit`);
      continue;
    }

    if (value[name] === null || value[name] === undefined) {
      if (field.required) issues.push(`${name} ne peut pas être vide`);
      continue;
    }

    const problem = checkType(field, value[name]);
    if (problem) issues.push(`${name} : ${problem}`);
  }

  for (const name of Object.keys(value)) {
    if (!fields[name]) issues.push(`${name} n'existe pas dans le CDM`);
  }

  if (issues.length) throw new CdmValidationError(entityName, issues);
  return value;
}

/** Variante non levante, pour les cas où l'appelant veut la liste des problèmes. */
function check(entityName, value, options) {
  try {
    validate(entityName, value, options);
    return { valid: true, issues: [] };
  } catch (err) {
    if (err instanceof CdmValidationError) return { valid: false, issues: err.issues };
    throw err;
  }
}

module.exports = { validate, check, fieldsOf, CdmValidationError };
