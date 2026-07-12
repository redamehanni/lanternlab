/** Dispatch feature flags — rollback offer mode via DISPATCH_OFFER_MODE=0 */
const OFFER_MODE = process.env.DISPATCH_OFFER_MODE !== '0';

const OFFER_DURATION_SEC = 20;
const BASE_EARNINGS = 3.99;
const BONUS_RATE = 0.10;

module.exports = {
  OFFER_MODE,
  OFFER_DURATION_SEC,
  BASE_EARNINGS,
  BONUS_RATE,
};
