/**
 * Lantern Engine E0 — constantes et formes documentaires.
 * Aucune logique métier par Lanterne : uniquement des catalogues génériques.
 */

const ENGINE_SCHEMA_VERSION = 1;

const RUN_CHANNELS = Object.freeze(['lab', 'preview', 'production']);

const EVENT_SOURCES = Object.freeze(['mobile', 'scheduler', 'lab_sim', 'forced', 'system']);

const MATCH_POLICIES = Object.freeze({
  ALL: 'all',
  FIRST: 'first',
});

const OCCURRENCE_KINDS = Object.freeze({
  ALWAYS: 'always',
  ONCE_PER_RUN: 'once_per_run',
  ONCE_PER_PLAYER: 'once_per_player',
  ONCE_PER_TEAM: 'once_per_team',
  ONCE_PER_OCCURRENCE: 'once_per_occurrence',
  DAILY: 'daily',
});

const MISS_POLICIES = Object.freeze({
  EXPIRE: 'expire',
  SKIP_WAIT_NEXT: 'skip_wait_next',
  DELIVER_LATE: 'deliver_late',
});

const MEDIA_STATES = Object.freeze(['discovered', 'unlocked', 'opened', 'consumed', 'visible']);

const ACTION_CRITICALITY = Object.freeze({
  CRITICAL: 'critical',
  NON_CRITICAL: 'non_critical',
});

module.exports = {
  ENGINE_SCHEMA_VERSION,
  RUN_CHANNELS,
  EVENT_SOURCES,
  MATCH_POLICIES,
  OCCURRENCE_KINDS,
  MISS_POLICIES,
  MEDIA_STATES,
  ACTION_CRITICALITY,
};
