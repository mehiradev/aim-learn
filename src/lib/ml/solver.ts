/**
 * Automatic Solver — utilise le modèle entraîné pour choisir angle et puissance.
 * Le réseau reçoit la distance de la cible et la masse du boulet, et renvoie
 * l'angle et la puissance. Si aucun boulet n'est imposé, on teste les 3 et on
 * garde celui qui approche le mieux la cible.
 */
import { simulateShot, type Environment } from "../ballistics/physics";
import { BALL_LIST, BALLS, type BallId } from "../ballistics/projectiles";
import { clampAngle, clampPower } from "./training";
import { makeFeatures, type MLModel } from "./types";

export interface Solution {
  ballId: BallId;
  angleDeg: number;
  power: number;
  predictedError: number;
}

export function solve(
  model: MLModel,
  targetDistance: number,
  env: Environment,
  ballId?: BallId,
): Solution {
  const candidates = ballId ? [BALLS[ballId]] : BALL_LIST;

  let best: Solution | null = null;
  for (const ball of candidates) {
    const p = model.predict(makeFeatures(targetDistance, ball.mass));
    const angleDeg = clampAngle(p.angleDeg);
    const power = clampPower(p.power);
    const shot = simulateShot({ angleDeg, mass: ball.mass }, { ...env, power });
    const err = Math.abs(shot.range - targetDistance);
    if (!best || err < best.predictedError) {
      best = { ballId: ball.id, angleDeg, power, predictedError: err };
    }
  }
  return best!;
}
