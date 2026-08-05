/** Projectile Models — trois modèles de boulets, seule la masse diffère. */

export type BallId = "light" | "medium" | "heavy";

export interface BallModel {
  id: BallId;
  label: string;
  /** Masse en kg */
  mass: number;
  /** Rayon d'affichage en px */
  radius: number;
}

export const BALLS: Record<BallId, BallModel> = {
  light: { id: "light", label: "Boulet léger", mass: 2, radius: 5 },
  medium: { id: "medium", label: "Boulet moyen", mass: 6, radius: 7 },
  heavy: { id: "heavy", label: "Boulet lourd", mass: 12, radius: 9 },
};

export const BALL_LIST: BallModel[] = [BALLS.light, BALLS.medium, BALLS.heavy];
