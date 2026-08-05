/** Régression ridge sur base polynomiale (degré 2) — modèle supervisé classique. */
import { makeFeatures, type Features, type MLModel, type Sample } from "./types";

/** Expansion polynomiale : 1, xi, xi*xj */
function expand(x: Features): number[] {
  const out: number[] = [1];
  for (let i = 0; i < x.length; i++) out.push(x[i] as number);
  for (let i = 0; i < x.length; i++)
    for (let j = i; j < x.length; j++) out.push((x[i] as number) * (x[j] as number));
  return out;
}

/** Résolution d'un système linéaire par élimination de Gauss avec pivot. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i] as number]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs((M[r] as number[])[col] as number) > Math.abs((M[pivot] as number[])[col] as number)) pivot = r;
    const tmp = M[col] as number[];
    M[col] = M[pivot] as number[];
    M[pivot] = tmp;
    const pv = (M[col] as number[])[col] as number;
    if (Math.abs(pv) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = ((M[r] as number[])[col] as number) / pv;
      if (!factor) continue;
      for (let c = col; c <= n; c++)
        (M[r] as number[])[c] = ((M[r] as number[])[c] as number) - factor * ((M[col] as number[])[c] as number);
    }
  }
  return Array.from({ length: n }, (_, i) => {
    const d = (M[i] as number[])[i] as number;
    return Math.abs(d) < 1e-12 ? 0 : ((M[i] as number[])[n] as number) / d;
  });
}

export class PolynomialRidgeModel implements MLModel {
  readonly id = "ridge";
  readonly label = "Régression polynomiale (ridge)";
  readonly description = "Modèle supervisé : moindres carrés régularisés sur une base polynomiale de degré 2.";

  private weights: number[] | null = null;
  private mean: number[] = [];
  private std: number[] = [];

  constructor(private lambda = 1e-3) {}

  fit(samples: Sample[]): void {
    if (samples.length < 12) throw new Error("Jeu de données trop petit");
    const X = samples.map((s) => expand(makeFeatures(s.distance, s.mass, s.speed, s.gravity)));
    const y = samples.map((s) => s.angle);
    const d = (X[0] as number[]).length;

    // Standardisation (colonne 0 = biais, laissée telle quelle)
    this.mean = Array(d).fill(0);
    this.std = Array(d).fill(1);
    for (let c = 1; c < d; c++) {
      const col = X.map((r) => (r as number[])[c] as number);
      const m = col.reduce((a, b) => a + b, 0) / col.length;
      const v = Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length) || 1;
      this.mean[c] = m;
      this.std[c] = v;
      for (const r of X) (r as number[])[c] = (((r as number[])[c] as number) - m) / v;
    }

    // Équations normales : (XᵀX + λI) w = Xᵀy
    const A: number[][] = Array.from({ length: d }, () => Array(d).fill(0));
    const b: number[] = Array(d).fill(0);
    for (let i = 0; i < X.length; i++) {
      const row = X[i] as number[];
      for (let a = 0; a < d; a++) {
        b[a] = (b[a] as number) + (row[a] as number) * (y[i] as number);
        for (let c = 0; c < d; c++)
          (A[a] as number[])[c] = ((A[a] as number[])[c] as number) + (row[a] as number) * (row[c] as number);
      }
    }
    for (let i = 1; i < d; i++) (A[i] as number[])[i] = ((A[i] as number[])[i] as number) + this.lambda * X.length;

    this.weights = solve(A, b);
  }

  predict(x: Features): number {
    if (!this.weights) throw new Error("Modèle non entraîné");
    const f = expand(x);
    let sum = 0;
    for (let i = 0; i < f.length; i++) {
      const v = i === 0 ? 1 : ((f[i] as number) - (this.mean[i] as number)) / (this.std[i] as number);
      sum += v * (this.weights[i] as number);
    }
    return sum;
  }

  isTrained(): boolean {
    return this.weights !== null;
  }
}
