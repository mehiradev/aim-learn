/**
 * Machine Learning Engine — contrat commun à tous les modèles.
 * Aucun code physique ici : le moteur ML ne manipule que des nombres.
 */

/** Une observation issue d'un tir d'essai. */
export interface Sample {
  /** Distance de la cible visée (m) — unique entrée du réseau */
  distance: number;
  /** Masse du boulet utilisé lors de l'essai (kg) */
  mass: number;
  /** Gravité de l'environnement (m/s²) */
  gravity: number;
  /** Sortie 1 : angle de tir (degrés) */
  angle: number;
  /** Sortie 2 : puissance du canon (joules) */
  power: number;
}

/** Vecteur d'entrée du modèle : uniquement la distance de la cible. */
export type Features = [distance: number];

export function makeFeatures(distance: number): Features {
  return [distance];
}

/** Sortie du modèle : les deux réglages du canon. */
export interface Prediction {
  angleDeg: number;
  power: number;
}

/** Interface à implémenter pour brancher n'importe quel algorithme. */
export interface MLModel {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Entraîne le modèle sur le jeu d'essais. */
  fit(samples: Sample[]): void;
  /** Prédit l'angle et la puissance pour une distance de cible donnée. */
  predict(x: Features): Prediction;
  /** true dès que fit() a été appelé avec succès. */
  isTrained(): boolean;
}
