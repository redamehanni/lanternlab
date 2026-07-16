/**
 * Identity Engine — Registre des usages d'identité (purposes).
 *
 * Point d'extension unique (principe Open/Closed) : un besoin d'identification
 * déclare ici un `purpose` avec sa durée de vie, sa cadence de rotation, les
 * rôles autorisés à vérifier, et surtout son CONTRAT DE DIVULGATION (les seuls
 * champs d'identité exposables). Le moteur (`identityEngine.js`) ne contient
 * aucune connaissance métier : il lit ce registre.
 *
 * Principe fondamental : l'identité IDENTIFIE, elle n'accorde jamais un droit.
 * Le registre ne décrit donc que « qui peut demander à identifier qui, et
 * quelles informations minimales sont révélées » — jamais une décision métier.
 *
 * Le QR n'apparaît nulle part ici : il n'est qu'un CANAL de présentation, au
 * bord client. Le handle produit par le moteur est neutre vis-à-vis du transport.
 */

// ── Statuts d'un jeton de présentation ────────────────────────────────────────
const PRESENTATION_STATUS = {
  ACTIVE: 'active',   // présentable et vérifiable
  USED: 'used',       // consommé par une vérification (usage unique)
  EXPIRED: 'expired', // TTL dépassé ou remplacé par rotation
  REVOKED: 'revoked', // invalidé (déconnexion, incident)
};

// ── Types d'événements du journal append-only (audit) ─────────────────────────
const EVENT_TYPE = {
  ISSUED: 'issued',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
};

// ── Rôles Ma Zone connus (pour valider les rôles vérificateurs) ───────────────
const KNOWN_ROLES = ['client', 'merchant', 'driver'];

// ── Contrat de divulgation (garde-fou vie privée, miroir ADR-005 du Wallet) ────
// Un `purpose` ne peut exposer QUE des champs présents dans cette allowlist.
// JAMAIS d'email, de rôle, ni d'identifiant technique au-delà du subjectId.
// Chaque champ est résolu de façon bornée par l'engine (DISCLOSURE_RESOLVERS).
const DISCLOSURE_ALLOWLIST = new Set([
  'displayName',
  'photoUrl',
]);

/**
 * Normalise une déclaration de purpose avec des valeurs par défaut saines.
 */
function definePurpose(def) {
  return {
    id: def.id,
    label: def.label,
    ttlSeconds: def.ttlSeconds || 120,
    rotateSeconds: def.rotateSeconds || 45,
    verifierRoles: def.verifierRoles || [],
    disclosure: def.disclosure || [],
  };
}

/**
 * Registre des purposes. V1 : un seul usage — l'identité personnelle.
 * Les usages futurs (access, pickup, civic, proxy...) s'ajouteront ici de
 * façon déclarative, sans modifier le cœur transactionnel.
 */
const PURPOSES = {
  identity: definePurpose({
    id: 'identity',
    label: 'Identification personnelle',
    ttlSeconds: 120,
    rotateSeconds: 45,
    verifierRoles: ['merchant', 'driver'],
    disclosure: ['displayName', 'photoUrl'],
  }),
};

/**
 * Vérifie les contrats au chargement (fail-fast) : divulgation bornée et rôles
 * vérificateurs connus. Empêche l'organe de dériver en « super-moteur » ou de
 * fuiter des données personnelles non prévues.
 */
function validatePurposeContract() {
  for (const p of Object.values(PURPOSES)) {
    for (const field of p.disclosure) {
      if (!DISCLOSURE_ALLOWLIST.has(field)) {
        throw new Error(
          `[IdentityRegistry] Violation du contrat de divulgation : le purpose "${p.id}" ` +
          `expose le champ "${field}" hors allowlist. Champs autorisés : ` +
          `${[...DISCLOSURE_ALLOWLIST].join(', ')}.`
        );
      }
    }
    for (const role of p.verifierRoles) {
      if (!KNOWN_ROLES.includes(role)) {
        throw new Error(
          `[IdentityRegistry] Le purpose "${p.id}" déclare un rôle vérificateur inconnu : "${role}".`
        );
      }
    }
  }
}

validatePurposeContract();

// ── API du registre (lecture seule, pure) ─────────────────────────────────────

function isKnownPurpose(purpose) {
  return Object.prototype.hasOwnProperty.call(PURPOSES, purpose);
}

function getPurpose(purpose) {
  return PURPOSES[purpose] || null;
}

function listPurposes() {
  return Object.values(PURPOSES);
}

function getDisclosureContract(purpose) {
  return PURPOSES[purpose]?.disclosure || [];
}

function getVerifierRoles(purpose) {
  return PURPOSES[purpose]?.verifierRoles || [];
}

function canVerify(purpose, role) {
  return getVerifierRoles(purpose).includes(role);
}

module.exports = {
  PRESENTATION_STATUS,
  EVENT_TYPE,
  KNOWN_ROLES,
  DISCLOSURE_ALLOWLIST,
  validatePurposeContract,
  isKnownPurpose,
  getPurpose,
  listPurposes,
  getDisclosureContract,
  getVerifierRoles,
  canVerify,
};
