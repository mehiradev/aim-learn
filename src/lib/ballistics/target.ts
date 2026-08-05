/** Target Generator — génération aléatoire de la cible sur terrain plat. */

export interface Target {
  /** Distance horizontale depuis le canon (m) */
  distance: number;
  /** Demi-largeur de la cible (m) : tolérance de réussite */
  halfWidth: number;
}

export function generateTarget(minDistance = 60, maxDistance = 340, halfWidth = 6): Target {
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
