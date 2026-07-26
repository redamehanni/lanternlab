/** Dispatch feature flags — rollback offer mode via DISPATCH_OFFER_MODE=0 */
const OFFER_MODE = process.env.DISPATCH_OFFER_MODE !== '0';

// 20 s en production. Configurable pour que les tests du cycle d'offre
// (proposition → expiration → réattribution) durent une seconde et non vingt.
const OFFER_DURATION_SEC = Number.parseInt(process.env.DISPATCH_OFFER_DURATION_SEC || '20', 10);
const BASE_EARNINGS = 3.99;
const BONUS_RATE = 0.10;

module.exports = {
  OFFER_MODE,
  OFFER_DURATION_SEC,
  BASE_EARNINGS,
  BONUS_RATE,
};
