/**
 * Machine Learning Engine — contrat commun à tous les modèles.
 * Aucun code physique ici : le moteur ML ne manipule que des nombres.
 */

/** Une observation issue d'un tir d'essai. */
export interface Sample {
  /** Distance à atteindre (= portée obtenue par ce tir) en m */
  distance: number;
  /** Masse du boulet (kg) */
  mass: number;
  /** Vitesse initiale (m/s) */
  speed: number;
  /** Gravité (m/s²) */
  gravity: number;
  /** Cible du modèle : angle de tir (degrés) */
  angle: number;
}

export type Features = [distance: number, mass: number, speed: number, gravity: number];

export function toFeatures(s: Pick<Sample, "distance" | "mass" | "speed" | "gravity">): Features {
  return [s.distance, s.mass, s.speed, s.gravity];
}

/** Interface à implémenter pour brancher n'importe quel algorithme. */
export interface MLModel {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Entraîne le modèle sur le jeu de données. */
  fit(samples: Sample[]): void;
  /** Prédit l'angle de tir (degrés) pour une configuration donnée. */
  predict(x: Features): number;
  /** true dès que fit() a été appelé avec succès. */
  isTrained(): boolean;
}
