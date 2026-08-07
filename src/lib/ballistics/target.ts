/** Target Generator — génération aléatoire de la cible sur terrain plat. */

export interface Target {
  /** Distance horizontale depuis le canon (m) */
  distance: number;
  /** Demi-largeur de la cible (m) : tolérance de réussite */
  halfWidth: number;
}

/** Plage de placement de la cible. */
export const TARGET_MIN_DISTANCE = 100;
export const TARGET_MAX_DISTANCE = 500;

/** Étendue horizontale fixe affichée par le simulateur (m). */
export const VIEW_MAX_DISTANCE = 550;

/** Cible déterministe utilisée au premier rendu (SSR) avant randomisation côté client. */
export const INITIAL_TARGET: Target = { distance: 300, halfWidth: 8 };

export function generateTarget(
  minDistance = TARGET_MIN_DISTANCE,
  maxDistance = TARGET_MAX_DISTANCE,
  halfWidth = 8,
): Target {
  const distance = minDistance + Math.random() * (maxDistance - minDistance);
  return { distance: Math.round(distance * 10) / 10, halfWidth };
}

export function evaluateShot(impactX: number, target: Target) {
  const error = impactX - target.distance;
  return {
    error,
    absError: Math.abs(error),
    hit: Math.abs(error) <= target.halfWidth,
  };
}
