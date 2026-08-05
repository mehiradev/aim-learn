/**
 * Automatic Solver — utilise le modèle entraîné pour choisir boulet + angle.
 * Le modèle prédit un angle ; on teste les 3 boulets et on garde le meilleur.
 */
import { simulateShot, type Environment } from "../ballistics/physics";
import { BALL_LIST, type BallId } from "../ballistics/projectiles";
import { clampAngle } from "./training";
import type { MLModel } from "./types";

export interface Solution {
  ballId: BallId;
  angleDeg: number;
  predictedError: number;
}

export function solve(model: MLModel, targetDistance: number, env: Environment): Solution {
  let best: Solution | null = null;
  for (const ball of BALL_LIST) {
    const angle = clampAngle(model.predict([targetDistance, ball.mass, env.initialSpeed, env.gravity]));
    const shot = simulateShot({ angleDeg: angle, mass: ball.mass }, env);
    const err = Math.abs(shot.range - targetDistance);
    if (!best || err < best.predictedError) {
      best = { ballId: ball.id, angleDeg: angle, predictedError: err };
    }
  }
  return best!;
}
