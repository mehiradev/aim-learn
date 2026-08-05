/** Registre des modèles disponibles — permet de remplacer l'algorithme facilement. */
import { KnnModel } from "./knn";
import { PolynomialRidgeModel } from "./ridge";
import type { MLModel } from "./types";

export type ModelId = "ridge" | "knn";

export const MODEL_FACTORIES: Record<ModelId, () => MLModel> = {
  ridge: () => new PolynomialRidgeModel(1e-3),
  knn: () => new KnnModel(5),
};

export const MODEL_OPTIONS: { id: ModelId; label: string; description: string }[] = (
  Object.keys(MODEL_FACTORIES) as ModelId[]
).map((id) => {
  const m = MODEL_FACTORIES[id]();
  return { id, label: m.label, description: m.description };
});

export function createModel(id: ModelId): MLModel {
  return MODEL_FACTORIES[id]();
}

export type { MLModel };
