/**
 * Training Manager — génère les tirs d'essai (dataset) puis entraîne le modèle.
 * C'est le seul module qui fait le pont entre la physique et le ML.
 */
import { simulateShot, type Environment } from "../ballistics/physics";
import { BALL_LIST } from "../ballistics/projectiles";
import { createModel, type ModelId } from "./registry";
import { makeFeatures, type MLModel, type Sample } from "./types";

/** Angles explorés : on reste sur la trajectoire tendue pour garder une fonction bijective. */
export const MIN_ANGLE = 5;
export const MAX_ANGLE = 45;

export interface TrainingMetrics {
  trials: number;
  /** Erreur moyenne d'angle sur le jeu de validation (degrés) */
  angleMae: number;
  /** Erreur moyenne de distance simulée sur validation (m) */
  distanceMae: number;
  /** Qualité du modèle : R² sur l'angle prédit */
  r2: number;
  /** Taux de tirs de validation tombant dans la cible */
  hitRate: number;
}

export interface TrainedModel {
  model: MLModel;
  modelId: ModelId;
  metrics: TrainingMetrics;
  dataset: Sample[];
  env: Environment;
  history: { trials: number; distanceMae: number }[];
}

/** Génère un lot de tirs d'essai aléatoires. */
export function generateTrials(count: number, env: Environment): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const ball = BALL_LIST[Math.floor(Math.random() * BALL_LIST.length)]!;
    const angle = MIN_ANGLE + Math.random() * (MAX_ANGLE - MIN_ANGLE);
    // On fait aussi varier légèrement l'environnement pour généraliser le modèle
    const speed = env.initialSpeed * (0.85 + Math.random() * 0.3);
    const gravity = env.gravity * (0.85 + Math.random() * 0.3);
    const shot = simulateShot({ angleDeg: angle, mass: ball.mass }, { ...env, initialSpeed: speed, gravity });
    samples.push({ distance: shot.range, mass: ball.mass, speed, gravity, angle });
  }
  return samples;
}

/** Évalue le modèle : erreur d'angle et erreur de distance réellement obtenue. */
export function evaluate(model: MLModel, validation: Sample[], env: Environment, halfWidth: number): TrainingMetrics {
  let angleErr = 0;
  let distErr = 0;
  let hits = 0;
  let ssRes = 0;
  let ssTot = 0;
  const meanAngle = validation.reduce((a, s) => a + s.angle, 0) / validation.length;

  for (const s of validation) {
    const predicted = clampAngle(model.predict(makeFeatures(s.distance, s.mass, s.speed, s.gravity)));
    angleErr += Math.abs(predicted - s.angle);
    ssRes += (predicted - s.angle) ** 2;
    ssTot += (s.angle - meanAngle) ** 2;
    const shot = simulateShot(
      { angleDeg: predicted, mass: s.mass },
      { ...env, initialSpeed: s.speed, gravity: s.gravity },
    );
    const e = Math.abs(shot.range - s.distance);
    distErr += e;
    if (e <= halfWidth) hits++;
  }

  const n = validation.length;
  return {
    trials: 0,
    angleMae: angleErr / n,
    distanceMae: distErr / n,
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 0,
    hitRate: hits / n,
  };
}

export function clampAngle(a: number): number {
  return Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, a));
}

/**
 * Entraîne un modèle par lots successifs afin d'afficher la progression.
 * onProgress est appelé après chaque lot.
 */
export async function trainModel(options: {
  modelId: ModelId;
  totalTrials: number;
  batches: number;
  env: Environment;
  halfWidth: number;
  onProgress?: (info: { progress: number; trials: number; metrics: TrainingMetrics }) => void;
}): Promise<TrainedModel> {
  const { modelId, totalTrials, batches, env, halfWidth, onProgress } = options;
  const dataset: Sample[] = [];
  const history: { trials: number; distanceMae: number }[] = [];
  let model = createModel(modelId, env);
  let metrics: TrainingMetrics = { trials: 0, angleMae: 0, distanceMae: 0, r2: 0, hitRate: 0 };
  const perBatch = Math.max(10, Math.round(totalTrials / batches));

  for (let b = 0; b < batches; b++) {
    dataset.push(...generateTrials(perBatch, env));
    const split = Math.floor(dataset.length * 0.8);
    const train = dataset.slice(0, split);
    const validation = dataset.slice(split);
    model = createModel(modelId, env);
    model.fit(train);
    metrics = { ...evaluate(model, validation, env, halfWidth), trials: dataset.length };
    history.push({ trials: dataset.length, distanceMae: metrics.distanceMae });
    onProgress?.({ progress: (b + 1) / batches, trials: dataset.length, metrics });
    // Laisse respirer le thread principal pour que l'UI se rafraîchisse
    await new Promise((r) => setTimeout(r, 0));
  }

  return { model, modelId, metrics, dataset, env, history };
}
