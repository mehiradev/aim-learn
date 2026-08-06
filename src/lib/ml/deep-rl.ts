/**
 * Deep Reinforcement Learning — politique gaussienne (REINFORCE avec critique).
 *
 * Architecture définie ici :
 *  - Couche d'entrée   : 5 neurones  (distance, masse, vitesse, gravité, ratio balistique d·g/v²)
 *  - Couche cachée 1   : 24 neurones (tanh)
 *  - Couche cachée 2   : 16 neurones (tanh)
 *  - Couche de sortie  : 2 neurones  (μ via sigmoïde → angle ∈ [5°,45°], log σ pour l'exploration)
 *  - Réseau critique   : 5 → 16 (tanh) → 1 neurone (valeur, baseline de l'avantage)
 *
 * L'apprentissage n'est pas supervisé : le réseau tire (action = angle échantillonné),
 * reçoit une récompense = -|portée obtenue - distance visée| / distance visée,
 * puis met à jour ses poids dans la direction du gradient de la politique.
 */
import { analyticRange } from "../ballistics/physics";
import type { Features, MLModel, Sample } from "./types";

export const RL_INPUT_NEURONS = 5;
export const RL_HIDDEN_LAYERS = [24, 16];
export const RL_OUTPUT_NEURONS = 2;
export const RL_CRITIC_HIDDEN = [16];

const MIN_A = 5;
const MAX_A = 45;

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

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
  backward(dOut: number[], lr: number, momentum = 0.9): number[] {
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

export class DeepRLModel implements MLModel {
  readonly id = "deeprl";
  readonly label = "Deep RL (réseau de neurones)";
  readonly description =
    "Réseau 5 → 24 → 16 → 2 entraîné par renforcement (REINFORCE + critique) : il tire, mesure sa récompense et corrige ses poids.";

  private actor = new Mlp([RL_INPUT_NEURONS, ...RL_HIDDEN_LAYERS, RL_OUTPUT_NEURONS]);
  private critic = new Mlp([RL_INPUT_NEURONS, ...RL_CRITIC_HIDDEN, 1]);
  private mean = new Array(RL_INPUT_NEURONS).fill(0);
  private std = new Array(RL_INPUT_NEURONS).fill(1);
  private trained = false;
  private epochs = 24;

  constructor(epochs = 24) {
    this.epochs = epochs;
  }

  private normalize(x: Features | number[]): number[] {
    return Array.from({ length: RL_INPUT_NEURONS }, (_, i) => (x[i]! - this.mean[i]!) / (this.std[i]! || 1));
  }

  fit(samples: Sample[]): void {
    if (samples.length === 0) return;
    const raw = samples.map((s) => [s.distance, s.mass, s.speed, s.gravity, (s.distance * s.gravity) / (s.speed * s.speed)]);
    for (let i = 0; i < RL_INPUT_NEURONS; i++) {
      const col = raw.map((r) => r[i]!);
      const m = col.reduce((a, b) => a + b, 0) / col.length;
      const v = col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length;
      this.mean[i] = m;
      this.std[i] = Math.sqrt(v) || 1;
    }

    const lrActor = 0.004;
    const lrCritic = 0.01;
    const pool = samples.length > 320 ? samples.slice(-320) : samples;
    let rewardStd = 0.3;

    for (let e = 0; e < this.epochs; e++) {
      for (const s of pool) {
        const x = this.normalize([s.distance, s.mass, s.speed, s.gravity, (s.distance * s.gravity) / (s.speed * s.speed)]);

        // --- politique : μ (angle moyen) et σ (exploration) ---
        const out = this.actor.forward(x);
        const muRaw = Math.max(-8, Math.min(8, out[0]!));
        const logStd = Math.max(-2.5, Math.min(0.5, out[1]!));
        const muNorm = sigmoid(muRaw);
        const mu = MIN_A + muNorm * (MAX_A - MIN_A);
        const std = Math.max(0.5, Math.exp(logStd) * 5);

        const action = Math.max(MIN_A, Math.min(MAX_A, mu + randn() * std));

        // --- environnement : on tire et on mesure la récompense ---
        const reached = analyticRange(action, s.speed, s.gravity);
        const reward = -Math.abs(reached - s.distance) / Math.max(1, s.distance);

        // --- critique (baseline) ---
        const value = this.critic.forward(x)[0]!;
        let advantage = reward - value;
        this.critic.backward([Math.max(-1, Math.min(1, 2 * (value - reward)))], lrCritic);

        // normalisation de l'avantage (stabilise le gradient de politique)
        rewardStd = 0.95 * rewardStd + 0.05 * Math.abs(advantage);
        advantage = Math.max(-3, Math.min(3, advantage / (rewardStd || 1)));

        // --- gradient de politique (maximiser advantage * logπ) ---
        const clip = (g: number) => Math.max(-1, Math.min(1, g));
        const dLogp_dMu = (action - mu) / (std * std);
        const dMu_dMuRaw = (MAX_A - MIN_A) * muNorm * (1 - muNorm);
        const gMu = clip(-advantage * dLogp_dMu * dMu_dMuRaw);
        const dLogp_dLogStd = ((action - mu) ** 2) / (std * std) - 1;
        const gLogStd = clip(-advantage * dLogp_dLogStd * 0.1);
        this.actor.backward([gMu, gLogStd], lrActor);
      }
    }
    this.trained = true;
  }

  predict(x: Features): number {
    const out = this.actor.forward(this.normalize(x));
    return MIN_A + sigmoid(out[0]!) * (MAX_A - MIN_A);
  }

  isTrained(): boolean {
    return this.trained;
  }
}
