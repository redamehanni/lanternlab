/**
 * CDM — Canonical Domain Model. Façade et validation au démarrage.
 *
 * LOI 4 : ce dossier n'importe JAMAIS `src/db`. Un test de dépendance et un
 * contrôle de CI le vérifient. Le jour où le CDM lit la base, il devient un god
 * object dont tous les organes dépendent, et l'architecture est perdue.
 *
 * Validation fail-fast, sur le modèle de `validateCapabilityContract()` du
 * `walletRegistry` : une incohérence de vocabulaire fait échouer le démarrage
 * plutôt que de produire une survente six mois plus tard.
 */

const { ENTITIES, ENTITY_NAMES } = require('./entities');
const { TYPES, TYPE_NAMES } = require('./types');
const ownership = require('./ownership');
const { validate, check, fieldsOf, CdmValidationError } = require('./validate');

/**
 * Contrôle la cohérence interne du dictionnaire. Retourne la liste des problèmes
 * plutôt que de lever, pour qu'un test puisse tous les afficher d'un coup.
 */
function collectIssues() {
  const issues = [];

  for (const [entityName, entity] of Object.entries(ENTITIES)) {
    if (!entity.table) issues.push(`${entityName} : table manquante`);
    if (!['live', 'planned'].includes(entity.status)) {
      issues.push(`${entityName} : statut invalide « ${entity.status} »`);
    }
    if (entity.status === 'planned' && !entity.since) {
      issues.push(`${entityName} : une entité planifiée doit indiquer son étape (\`since\`)`);
    }
    if (!entity.fields || Object.keys(entity.fields).length === 0) {
      issues.push(`${entityName} : aucun champ déclaré`);
      continue;
    }

    const allFields = { ...entity.fields, ...(entity.computed || {}) };

    for (const [fieldName, field] of Object.entries(allFields)) {
      if (!TYPE_NAMES.includes(field.type)) {
        issues.push(`${entityName}.${fieldName} : type inconnu « ${field.type} »`);
      }
      if (field.type === 'enum' && !Array.isArray(field.values)) {
        issues.push(`${entityName}.${fieldName} : une énumération doit lister ses valeurs`);
      }
      if (field.references && !ENTITIES[field.references]) {
        issues.push(`${entityName}.${fieldName} : référence une entité inconnue « ${field.references} »`);
      }

      // LOI 3 : chaque attribut a un propriétaire nommé.
      const role = ownership.roleOf(entityName, fieldName);
      if (!role) {
        issues.push(`${entityName}.${fieldName} : aucun rôle de propriété déclaré (Loi 3)`);
      } else if (!ownership.ROLES.includes(role)) {
        issues.push(`${entityName}.${fieldName} : rôle inconnu « ${role} »`);
      }
    }

    // Un attribut dérivé doit dire de quoi il dérive, sinon il est indéfendable.
    for (const [fieldName, field] of Object.entries(entity.computed || {})) {
      if (!field.formula) {
        issues.push(`${entityName}.${fieldName} : un attribut calculé doit porter sa formule`);
      }
      if (ownership.roleOf(entityName, fieldName) !== 'calculated') {
        issues.push(`${entityName}.${fieldName} : déclaré dans \`computed\` mais pas « calculated » dans la matrice`);
      }
    }
  }

  // Une entrée de propriété qui ne correspond à rien signale un renommage oublié.
  for (const key of Object.keys(ownership.OWNERSHIP)) {
    const [entityName, attribute] = key.split('.');
    if (!ENTITIES[entityName]) {
      issues.push(`Matrice de propriété : entité inconnue « ${entityName} »`);
      continue;
    }
    if (attribute === '*') continue;
    if (!fieldsOf(entityName)[attribute]) {
      issues.push(`Matrice de propriété : ${key} ne correspond à aucun champ`);
    }
  }

  // Les rôles dépendants du mode doivent couvrir tous les modes.
  for (const [key, declaration] of Object.entries(ownership.OWNERSHIP)) {
    const normalized = ownership.normalize(declaration);
    if (!normalized.byMode) continue;
    for (const mode of ownership.INVENTORY_MODES) {
      if (!normalized.byMode[mode]) {
        issues.push(`Matrice de propriété : ${key} ne déclare pas de rôle pour le mode « ${mode} »`);
      }
    }
  }

  return issues;
}

/** Fail-fast au démarrage : un vocabulaire incohérent ne doit pas se propager. */
function assertConsistent() {
  const issues = collectIssues();
  if (issues.length) {
    throw new Error(`CDM incohérent :\n  - ${issues.join('\n  - ')}`);
  }
}

assertConsistent();

/** Entités réellement présentes en base aujourd'hui. */
function liveEntities() {
  return ENTITY_NAMES.filter((name) => ENTITIES[name].status === 'live');
}

/** Nom canonique d'une entité à partir de sa table (`missions` → `Delivery`). */
function entityForTable(table) {
  return ENTITY_NAMES.find((name) => ENTITIES[name].table === table) || null;
}

module.exports = {
  ENTITIES,
  ENTITY_NAMES,
  TYPES,
  TYPE_NAMES,
  ownership,
  validate,
  check,
  fieldsOf,
  liveEntities,
  entityForTable,
  collectIssues,
  assertConsistent,
  CdmValidationError,
};
