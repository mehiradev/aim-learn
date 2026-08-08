/**
 * Deep Reinforcement Learning — politique gaussienne (REINFORCE avec critique).
 *
 * Architecture définie ici :
 *  - Couche d'entrée   : 2 neurones  (distance de la cible et masse du boulet, normalisées)
 *  - Couche cachée 1   : 16 neurones (tanh)
 *  - Couche cachée 2   : 12 neurones (tanh)
 *  - Couche de sortie  : 2 neurones  (angle de tir ∈ [30°,45°] et puissance ∈ [1 kJ,60 kJ])
 *  - Réseau critique   : 2 → 16 (tanh) → 1 neurone (valeur, baseline de l'avantage)
 *
 * L'apprentissage n'est pas supervisé : à chaque essai le réseau reçoit une
 * distance de cible tirée au hasard, propose un couple (angle, puissance),
 * observe la portée réellement obtenue, reçoit une récompense
 * = -|portée - distance visée| / distance visée, puis corrige ses poids.
 */
import { analyticRange, MAX_POWER, MIN_POWER, speedFromPower } from "../ballistics/physics";
import type { Features, MLModel, Prediction, Sample } from "./types";

export const RL_INPUT_NEURONS = 2;
export const RL_HIDDEN_LAYERS = [16, 12];
export const RL_OUTPUT_NEURONS = 2;
export const RL_CRITIC_HIDDEN = [16];

const MIN_A = 30;
const MAX_A = 45;

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp01 = (v: number) => Math.max(0.001, Math.min(0.999, v));

class Dense {
  W: number[][];
  b: number[];
  private vW: number[][];
  private vb: number[];
  input: number[] = [];
  z: number[] = [];
  out: number[] = [];

  constructor(
    readonly nIn: number,
    readonly nOut: number,
    readonly act: "tanh" | "linear",
  ) {
    const scale = Math.sqrt(2 / (nIn + nOut));
    this.W = Array.from({ length: nOut }, () => Array.from({ length: nIn }, () => randn() * scale));
    this.b = new Array(nOut).fill(0);
    this.vW = Array.from({ length: nOut }, () => new Array(nIn).fill(0));
    this.vb = new Array(nOut).fill(0);
  }

  forward(x: number[]): number[] {
    this.input = x;
    this.z = new Array(this.nOut);
    this.out = new Array(this.nOut);
    for (let o = 0; o < this.nOut; o++) {
      let s = this.b[o]!;
      const row = this.W[o]!;
      for (let i = 0; i < this.nIn; i++) s += row[i]! * x[i]!;
      this.z[o] = s;
      this.out[o] = this.act === "tanh" ? Math.tanh(s) : s;
    }
    return this.out;
  }

  /** Rétropropage dOut (dL/dOut) et applique la mise à jour. Renvoie dL/dInput. */
  backward(dOut: number[], lr: number, momentum = 0.6): number[] {
    const dIn = new Array(this.nIn).fill(0);
    for (let o = 0; o < this.nOut; o++) {
      const grad = this.act === "tanh" ? dOut[o]! * (1 - this.out[o]! ** 2) : dOut[o]!;
      const row = this.W[o]!;
      const vRow = this.vW[o]!;
      for (let i = 0; i < this.nIn; i++) {
        dIn[i] += grad * row[i]!;
        vRow[i] = momentum * vRow[i]! - lr * grad * this.input[i]!;
        row[i] = row[i]! + vRow[i]!;
      }
      this.vb[o] = momentum * this.vb[o]! - lr * grad;
      this.b[o] = this.b[o]! + this.vb[o]!;
    }
    return dIn;
  }
}

class Mlp {
  layers: Dense[] = [];
  constructor(sizes: number[]) {
    for (let i = 0; i < sizes.length - 1; i++) {
      this.layers.push(new Dense(sizes[i]!, sizes[i + 1]!, i === sizes.length - 2 ? "linear" : "tanh"));
    }
  }
  forward(x: number[]): number[] {
    let a = x;
    for (const l of this.layers) a = l.forward(a);
    return a;
  }
  backward(d: number[], lr: number): void {
    let g = d;
    for (let i = this.layers.length - 1; i >= 0; i--) g = this.layers[i]!.backward(g, lr);
  }
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export type RangeFn = (angleDeg: number, power: number, mass: number, gravity: number) => number;

export class DeepRLModel implements MLModel {
  readonly id = "deeprl";
  readonly label = "Deep RL (réseau de neurones)";
  readonly description =
    "Réseau 2 → 16 → 12 → 2 entraîné par renforcement (REINFORCE + critique) : à partir de la distance de la cible et de la masse du boulet, il propose un angle et une puissance, tire, puis corrige ses poids.";

  readonly hiddenLayers: number[];
  private actor: Mlp;
  private critic = new Mlp([RL_INPUT_NEURONS, ...RL_CRITIC_HIDDEN, 1]);
  private mean = 0;
  private std = 1;
  private massMean = 0;
  private massStd = 1;
  private trained = false;
  private epochs: number;
  /** Simulateur d'environnement utilisé pour la récompense (injecté par le registre). */
  private rangeFn: RangeFn;

  constructor(epochs = 120, rangeFn?: RangeFn, hiddenLayers?: number[]) {
    this.epochs = epochs;
    const layers = (hiddenLayers && hiddenLayers.length > 0 ? hiddenLayers : RL_HIDDEN_LAYERS).map((n) =>
      Math.max(1, Math.round(n)),
    );
    this.hiddenLayers = layers;
    this.actor = new Mlp([RL_INPUT_NEURONS, ...layers, RL_OUTPUT_NEURONS]);
    this.rangeFn =
      rangeFn ?? ((angle, power, mass, gravity) => analyticRange(angle, speedFromPower(power, mass), gravity));
  }

  private normalize(distance: number, mass: number): number[] {
    return [(distance - this.mean) / (this.std || 1), (mass - this.massMean) / (this.massStd || 1)];
  }

  private decode(out: number[]): { angleNorm: number; powerNorm: number } {
    return { angleNorm: sigmoid(out[0]!), powerNorm: sigmoid(out[1]!) };
  }

  fit(samples: Sample[]): void {
    if (samples.length === 0) return;
    const dists = samples.map((s) => s.distance);
    this.mean = dists.reduce((a, b) => a + b, 0) / dists.length;
    this.std = Math.sqrt(dists.reduce((a, b) => a + (b - this.mean) ** 2, 0) / dists.length) || 1;
    const masses = samples.map((s) => s.mass);
    this.massMean = masses.reduce((a, b) => a + b, 0) / masses.length;
    this.massStd = Math.sqrt(masses.reduce((a, b) => a + (b - this.massMean) ** 2, 0) / masses.length) || 1;

    const lrActor = 0.02;
    const lrCritic = 0.05;
    const pool = samples.length > 400 ? samples.slice(-400) : samples;
    let advStd = 0.3;

    for (let e = 0; e < this.epochs; e++) {
      // exploration décroissante : large au début, fine en fin d'apprentissage
      const decay = Math.max(0.05, 1 - e / this.epochs);
      const sigma = 0.05 + 0.3 * decay;

      for (const s of pool) {
        const x = this.normalize(s.distance, s.mass);
        const out = this.actor.forward(x);
        const { angleNorm, powerNorm } = this.decode(out);

        // action = moyenne + bruit gaussien (dans l'espace normalisé [0,1])
        const aAngle = clamp01(angleNorm + randn() * sigma);
        const aPower = clamp01(powerNorm + randn() * sigma);

        const angle = MIN_A + aAngle * (MAX_A - MIN_A);
        const power = MIN_POWER + aPower * (MAX_POWER - MIN_POWER);

        // --- environnement : on tire et on mesure la récompense ---
        const reached = this.rangeFn(angle, power, s.mass, s.gravity);
        const reward = -Math.abs(reached - s.distance) / Math.max(1, s.distance);

        // --- critique (baseline) ---
        const value = this.critic.forward(x)[0]!;
        let advantage = reward - value;
        this.critic.backward([Math.max(-1, Math.min(1, 2 * (value - reward)))], lrCritic);

        advStd = 0.95 * advStd + 0.05 * Math.abs(advantage);
        advantage = Math.max(-3, Math.min(3, advantage / (advStd || 1)));

        // --- gradient de politique : maximiser advantage * log π(a|s) ---
        const clip = (g: number) => Math.max(-1, Math.min(1, g));
        const grad = (action: number, mu: number) => {
          const dLogp = (action - mu) / (sigma * sigma);
          return clip(-advantage * dLogp * mu * (1 - mu));
        };
        this.actor.backward([grad(aAngle, angleNorm), grad(aPower, powerNorm)], lrActor / (1 + e * 0.05));
      }
    }
    this.trained = true;
  }

  predict(x: Features): Prediction {
    const out = this.actor.forward(this.normalize(x[0], x[1]));
    const { angleNorm, powerNorm } = this.decode(out);
    return {
      angleDeg: MIN_A + angleNorm * (MAX_A - MIN_A),
      power: MIN_POWER + powerNorm * (MAX_POWER - MIN_POWER),
    };
  }

  isTrained(): boolean {
    return this.trained;
  }
}
