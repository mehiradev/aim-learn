/**
 * Training Manager — génère les essais (cibles de distances variées) puis entraîne le modèle.
 * C'est le seul module qui fait le pont entre la physique et le ML.
 */
import { MAX_POWER, MIN_POWER, powerFromSpeed, simulateShot, type Environment } from "../ballistics/physics";
import { BALL_LIST } from "../ballistics/projectiles";
import { TARGET_MAX_DISTANCE, TARGET_MIN_DISTANCE } from "../ballistics/target";
import { createModel, type ModelId, type RlConfig } from "./registry";
import { makeFeatures, type MLModel, type Sample } from "./types";

/** Angles explorés : on reste sur la trajectoire tendue pour garder une fonction bijective. */
export const MIN_ANGLE = 30;
export const MAX_ANGLE = 45;

export interface TrainingMetrics {
  trials: number;
  /** Erreur moyenne de distance obtenue sur les cibles de validation (m) */
  distanceMae: number;
  /** Qualité : R² sur la distance atteinte vs distance visée */
  r2: number;
  /** Taux de cibles de validation touchées */
  hitRate: number;
  /** Puissance moyenne proposée par le modèle (J) */
  avgPower: number;
  /** Angle moyen proposé par le modèle (°) */
  avgAngle: number;
}

export interface TrainedModel {
  model: MLModel;
  modelId: ModelId;
  metrics: TrainingMetrics;
  dataset: Sample[];
  env: Environment;
  mass: number;
  history: { trials: number; distanceMae: number }[];
}

export function clampAngle(a: number): number {
  return Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, a));
}

export function clampPower(p: number): number {
  return Math.min(MAX_POWER, Math.max(MIN_POWER, p));
}

/** Tire une distance de cible au hasard dans la plage de jeu. */
export function randomTargetDistance(): number {
  return TARGET_MIN_DISTANCE + Math.random() * (TARGET_MAX_DISTANCE - TARGET_MIN_DISTANCE);
}

/**
 * Génère un lot d'essais : à chaque fois une cible de distance différente,
 * un angle exploré au hasard et la puissance théoriquement adaptée.
 */
export function generateTrials(count: number, env: Environment, _mass: number): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const distance = randomTargetDistance();
    // on varie aussi le boulet : le réseau apprend l'influence de la masse
    const mass = BALL_LIST[i % BALL_LIST.length]!.mass;
    const angle = MIN_ANGLE + Math.random() * (MAX_ANGLE - MIN_ANGLE);
    const rad = (angle * Math.PI) / 180;
    const v2 = (distance * env.gravity) / Math.max(0.05, Math.sin(2 * rad));
    const power = clampPower(powerFromSpeed(Math.sqrt(v2), mass));
    const shot = simulateShot({ angleDeg: angle, mass }, { ...env, power });
    samples.push({ distance: shot.range, mass, gravity: env.gravity, angle, power });
  }
  return samples;
}

/** Évalue le modèle : erreur de distance réellement obtenue sur des cibles inédites. */
export function evaluate(
  model: MLModel,
  validation: Sample[],
  env: Environment,
  _mass: number,
  halfWidth: number,
): TrainingMetrics {
  let distErr = 0;
  let hits = 0;
  let ssRes = 0;
  let ssTot = 0;
  let sumPower = 0;
  let sumAngle = 0;
  const meanDist = validation.reduce((a, s) => a + s.distance, 0) / validation.length;

  for (const s of validation) {
    const p = model.predict(makeFeatures(s.distance, s.mass));
    const angle = clampAngle(p.angleDeg);
    const power = clampPower(p.power);
    sumAngle += angle;
    sumPower += power;
    const shot = simulateShot({ angleDeg: angle, mass: s.mass }, { ...env, power });
    const e = Math.abs(shot.range - s.distance);
    distErr += e;
    ssRes += (shot.range - s.distance) ** 2;
    ssTot += (s.distance - meanDist) ** 2;
    if (e <= halfWidth) hits++;
  }

  const n = validation.length;
  return {
    trials: 0,
    distanceMae: distErr / n,
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 0,
    hitRate: hits / n,
    avgPower: sumPower / n,
    avgAngle: sumAngle / n,
  };
}

/**
 * Entraîne un modèle par lots successifs afin d'afficher la progression.
 * onProgress est appelé après chaque lot.
 * Si `previous` est fourni, l'apprentissage se poursuit sur le même modèle
 * (les poids et le jeu d'essais existants sont conservés et affinés).
 */
export async function trainModel(options: {
  modelId: ModelId;
  totalTrials: number;
  batches: number;
  env: Environment;
  mass: number;
  halfWidth: number;
  rlConfig?: RlConfig;
  /** Modèle déjà entraîné à affiner (mode « continuer l'apprentissage »). */
  previous?: TrainedModel | null;
  onProgress?: (info: { progress: number; trials: number; metrics: TrainingMetrics }) => void;
}): Promise<TrainedModel> {
  const { modelId, totalTrials, batches, env, mass, halfWidth, rlConfig, previous, onProgress } = options;
  const resume = !!previous && previous.modelId === modelId;
  const dataset: Sample[] = resume ? [...previous!.dataset] : [];
  const history: { trials: number; distanceMae: number }[] = resume ? [...previous!.history] : [];
  let model = resume ? previous!.model : createModel(modelId, env, mass, rlConfig);
  let metrics: TrainingMetrics = resume
    ? previous!.metrics
    : {
        trials: 0,
        distanceMae: 0,
        r2: 0,
        hitRate: 0,
        avgPower: 0,
        avgAngle: 0,
      };
  const perBatch = Math.max(10, Math.round(totalTrials / batches));

  for (let b = 0; b < batches; b++) {
    dataset.push(...generateTrials(perBatch, env, mass));
    const split = Math.floor(dataset.length * 0.8);
    const train = dataset.slice(0, split);
    const validation = dataset.slice(split);
    // En reprise, on garde les poids appris ; sinon on repart d'un modèle neuf.
    if (!resume) model = createModel(modelId, env, mass, rlConfig);
    model.fit(train);
    metrics = { ...evaluate(model, validation, env, mass, halfWidth), trials: dataset.length };
    history.push({ trials: dataset.length, distanceMae: metrics.distanceMae });
    onProgress?.({ progress: (b + 1) / batches, trials: dataset.length, metrics });
    // Laisse respirer le thread principal pour que l'UI se rafraîchisse
    await new Promise((r) => setTimeout(r, 0));
  }

  return {
    model,
    modelId,
    metrics,
    dataset,
    env,
    mass,
    history,
    trainedAt: new Date().toISOString(),
    sessions: (resume ? previous!.sessions : 0) + 1,
  };
}

