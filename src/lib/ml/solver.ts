/**
 * Automatic Solver — utilise le modèle entraîné pour choisir boulet, angle et puissance.
 * Le réseau ne reçoit que la distance de la cible et renvoie l'angle et la puissance ;
 * on teste ensuite les 3 boulets et on garde celui qui approche le mieux la cible.
 */
import { simulateShot, type Environment } from "../ballistics/physics";
import { BALL_LIST, type BallId } from "../ballistics/projectiles";
import { clampAngle, clampPower } from "./training";
import { makeFeatures, type MLModel } from "./types";

export interface Solution {
  ballId: BallId;
  angleDeg: number;
  power: number;
  predictedError: number;
}

export function solve(model: MLModel, targetDistance: number, env: Environment): Solution {
  const p = model.predict(makeFeatures(targetDistance));
  const angleDeg = clampAngle(p.angleDeg);
  const power = clampPower(p.power);

  let best: Solution | null = null;
  for (const ball of BALL_LIST) {
    const shot = simulateShot({ angleDeg, mass: ball.mass }, { ...env, power });
    const err = Math.abs(shot.range - targetDistance);
    if (!best || err < best.predictedError) {
      best = { ballId: ball.id, angleDeg, power, predictedError: err };
    }
  }
  return best!;
}
