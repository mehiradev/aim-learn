/**
 * Régression ridge (degré 2) sur la distance — deux sorties : angle et puissance.
 */
import { MAX_POWER, MIN_POWER } from "../ballistics/physics";
import type { Features, MLModel, Prediction, Sample } from "./types";

/** Base polynomiale sur (distance, masse) : 1, d, d², m, m·d, m² */
function expand(distance: number, mass: number): number[] {
  return [1, distance, distance * distance, mass, mass * distance, mass * mass];
}

/** Résolution d'un système linéaire par élimination de Gauss avec pivot. */
function gauss(A: number[][], b: number[]): number[] {
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

function ridgeFit(X: number[][], y: number[], lambda: number): number[] {
  const d = (X[0] as number[]).length;
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
  for (let i = 1; i < d; i++) (A[i] as number[])[i] = ((A[i] as number[])[i] as number) + lambda * X.length;
  return gauss(A, b);
}

export class PolynomialRidgeModel implements MLModel {
  readonly id = "ridge";
  readonly label = "Régression polynomiale (ridge)";
  readonly description =
    "Modèle supervisé : moindres carrés régularisés sur une base polynomiale de la distance, deux sorties (angle, puissance).";

  private wAngle: number[] | null = null;
  private wPower: number[] | null = null;
  private scale = 1;

  constructor(private lambda = 1e-3) {}

  fit(samples: Sample[]): void {
    if (samples.length < 12) throw new Error("Jeu de données trop petit");
    this.scale = Math.max(1, ...samples.map((s) => s.distance));
    const X = samples.map((s) => expand(s.distance / this.scale));
    this.wAngle = ridgeFit(X, samples.map((s) => s.angle), this.lambda);
    this.wPower = ridgeFit(X, samples.map((s) => s.power / MAX_POWER), this.lambda);
  }

  predict(x: Features): Prediction {
    if (!this.wAngle || !this.wPower) throw new Error("Modèle non entraîné");
    const f = expand(x[0] / this.scale);
    const dot = (w: number[]) => f.reduce((acc, v, i) => acc + v * (w[i] as number), 0);
    return {
      angleDeg: dot(this.wAngle),
      power: Math.max(MIN_POWER, Math.min(MAX_POWER, dot(this.wPower) * MAX_POWER)),
    };
  }

  isTrained(): boolean {
    return this.wAngle !== null;
  }
}
