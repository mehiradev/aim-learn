/** k plus proches voisins pondérés par la distance — modèle non paramétrique. */
import type { Features, MLModel, Prediction, Sample } from "./types";

export class KnnModel implements MLModel {
  readonly id = "knn";
  readonly label = "k plus proches voisins";
  readonly description =
    "Modèle non paramétrique : retrouve les essais dont la distance de cible est la plus proche et moyenne leurs réglages.";

  private data: Sample[] = [];

  constructor(private k = 5) {}

  fit(samples: Sample[]): void {
    if (samples.length === 0) throw new Error("Jeu de données vide");
    this.data = samples.slice();
  }

  predict(x: Features): Prediction {
    if (this.data.length === 0) throw new Error("Modèle non entraîné");
    const target = x[0];
    const neighbours = this.data
      .map((s) => ({ s, d: Math.abs(s.distance - target) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.min(this.k, this.data.length));

    let wSum = 0;
    let angle = 0;
    let power = 0;
    for (const n of neighbours) {
      const w = 1 / (n.d + 1e-6);
      wSum += w;
      angle += w * n.s.angle;
      power += w * n.s.power;
    }
    return { angleDeg: angle / wSum, power: power / wSum };
  }

  isTrained(): boolean {
    return this.data.length > 0;
  }
}
