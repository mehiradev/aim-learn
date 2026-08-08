/** Registre des modèles disponibles — permet de remplacer l'algorithme facilement. */
import type { Environment } from "../ballistics/physics";
import { simulateShot } from "../ballistics/physics";
import { DeepRLModel } from "./deep-rl";
import { KnnModel } from "./knn";
import { PolynomialRidgeModel } from "./ridge";
import type { MLModel } from "./types";

export type ModelId = "deeprl" | "ridge" | "knn";

/** Hyper-paramètres réglables depuis l'interface pour le Deep RL. */
export interface RlConfig {
  /** Nombre de neurones de chaque couche intermédiaire. */
  hiddenLayers?: number[];
  /** Nombre d'essais (époques) d'apprentissage par renforcement. */
  epochs?: number;
}

export const MODEL_FACTORIES: Record<ModelId, (env?: Environment, mass?: number, config?: RlConfig) => MLModel> = {
  deeprl: (env, _mass, config) =>
    new DeepRLModel(
      config?.epochs ?? 140,
      env
        ? (angle, power, mass, gravity) => simulateShot({ angleDeg: angle, mass }, { ...env, power, gravity }).range
        : undefined,
      config?.hiddenLayers,
    ),
  ridge: () => new PolynomialRidgeModel(1e-3),
  knn: () => new KnnModel(5),
};

export const MODEL_OPTIONS: { id: ModelId; label: string; description: string }[] = (
  Object.keys(MODEL_FACTORIES) as ModelId[]
).map((id) => {
  const m = MODEL_FACTORIES[id]();
  return { id, label: m.label, description: m.description };
});

export function createModel(id: ModelId, env?: Environment, mass?: number, config?: RlConfig): MLModel {
  return MODEL_FACTORIES[id](env, mass, config);
}

export type { MLModel };
