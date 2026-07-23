/**
 * Motion — identité émotionnelle de Ma Zone.
 * Transitions lentes, apparitions douces, jamais nerveuses.
 */
export const MOTION = {
  duration: {
    instant: 120,
    fast: 220,
    base: 380,
    slow: 560,
    breathe: 800,
  },
  delay: {
    stagger: 70,
    section: 120,
  },
  spring: {
    soft: { tension: 48, friction: 14 },
    gentle: { tension: 56, friction: 12 },
    settle: { tension: 40, friction: 16 },
  },
  fadeIn: {
    duration: 480,
    translateY: 14,
  },
  press: {
    scaleIn: 0.975,
    scaleOut: 1,
  },
};

export default MOTION;
