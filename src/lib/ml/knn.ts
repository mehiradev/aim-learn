/** k plus proches voisins pondérés par la distance — modèle non paramétrique. */
import { makeFeatures, type Features, type MLModel, type Sample } from "./types";

export class KnnModel implements MLModel {
  readonly id = "knn";
  readonly label = "k plus proches voisins";
  readonly description = "Recherche les k tirs d'essai les plus proches et moyenne leurs angles.";

  private data: { x: Features; y: number }[] = [];
  private mean: number[] = [0, 0, 0, 0, 0];
  private std: number[] = [1, 1, 1, 1, 1];

  constructor(private k = 5) {}

  fit(samples: Sample[]): void {
    if (samples.length < this.k) throw new Error("Jeu de données trop petit");
    const raw: Features[] = samples.map((s) => makeFeatures(s.distance, s.mass, s.speed, s.gravity));
    for (let c = 0; c < 5; c++) {
      const col = raw.map((r) => r[c] as number);
      const m = col.reduce((a, b) => a + b, 0) / col.length;
      const v = Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length) || 1;
      this.mean[c] = m;
      this.std[c] = v;
    }
    this.data = samples.map((s, i) => ({ x: this.norm(raw[i] as Features), y: s.angle }));
  }

  private norm(x: Features): Features {
    return x.map((v, i) => (v - (this.mean[i] as number)) / (this.std[i] as number)) as Features;
  }

  predict(x: Features): number {
    if (!this.data.length) throw new Error("Modèle non entraîné");
    const q = this.norm(x);
    const scored = this.data
      .map((p) => ({ y: p.y, d: Math.hypot(...p.x.map((v, i) => v - (q[i] as number))) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.k);
    let num = 0;
    let den = 0;
    for (const s of scored) {
      const w = 1 / (s.d + 1e-6);
      num += w * s.y;
      den += w;
    }
    return num / den;
  }

  isTrained(): boolean {
    return this.data.length > 0;
  }
}
