/**
 * Physics Engine — moteur balistique 2D simple et pédagogique.
 * Aucune dépendance à l'UI ou au machine learning.
 */

export interface Environment {
  /** Gravité en m/s² (positive, vers le bas) */
  gravity: number;
  /** Vitesse initiale du projectile en m/s */
  initialSpeed: number;
  /** Frottements de l'air activés ou non */
  airDrag: boolean;
  /** Coefficient de frottement (F = -k * |v| * v) */
  dragCoefficient: number;
}

export const DEFAULT_ENVIRONMENT: Environment = {
  gravity: 9.81,
  initialSpeed: 60,
  airDrag: false,
  dragCoefficient: 0.02,
};

export interface Point {
  x: number;
  y: number;
}

export interface ShotResult {
  /** Points de la trajectoire (mètres, y = hauteur) */
  trajectory: Point[];
  /** Portée horizontale atteinte (m) */
  range: number;
  /** Temps de vol (s) */
  flightTime: number;
  /** Hauteur maximale atteinte (m) */
  apex: number;
}

export interface ShotParams {
  /** Angle de tir en degrés */
  angleDeg: number;
  /** Masse du boulet en kg */
  mass: number;
}

const DEG = Math.PI / 180;

/**
 * Portée analytique (sans frottements) : R = v² * sin(2θ) / g
 * La masse n'a aucun effet dans ce cas (physique classique du vide).
 */
export function analyticRange(angleDeg: number, speed: number, gravity: number): number {
  return (speed * speed * Math.sin(2 * angleDeg * DEG)) / gravity;
}

/**
 * Simule un tir et renvoie sa trajectoire échantillonnée.
 * Sans frottement : équations classiques du mouvement.
 * Avec frottement : intégration d'Euler semi-implicite (la masse joue alors un rôle).
 */
export function simulateShot(params: ShotParams, env: Environment): ShotResult {
  const { angleDeg, mass } = params;
  const theta = angleDeg * DEG;
  const v0 = env.initialSpeed;
  const g = env.gravity;

  const trajectory: Point[] = [];
  let apex = 0;

  if (!env.airDrag) {
    const flightTime = (2 * v0 * Math.sin(theta)) / g;
    const range = analyticRange(angleDeg, v0, g);
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const t = (flightTime * i) / steps;
      const x = v0 * Math.cos(theta) * t;
      const y = Math.max(0, v0 * Math.sin(theta) * t - 0.5 * g * t * t);
      apex = Math.max(apex, y);
      trajectory.push({ x, y });
    }
    return { trajectory, range, flightTime: Math.max(flightTime, 0), apex };
  }

  // Intégration numérique avec frottement quadratique
  const dt = 1 / 240;
  let x = 0;
  let y = 0;
  let vx = v0 * Math.cos(theta);
  let vy = v0 * Math.sin(theta);
  let t = 0;
  trajectory.push({ x, y });

  while (t < 120) {
    const speed = Math.hypot(vx, vy);
    const k = env.dragCoefficient;
    const ax = (-k * speed * vx) / mass;
    const ay = -g + (-k * speed * vy) / mass;
    vx += ax * dt;
    vy += ay * dt;
    const prevY = y;
    x += vx * dt;
    y += vy * dt;
    t += dt;
    apex = Math.max(apex, y);

    if (y <= 0 && t > dt) {
      // interpolation linéaire du point d'impact
      const ratio = prevY / (prevY - y || 1);
      const impactX = trajectory[trajectory.length - 1].x + (x - trajectory[trajectory.length - 1].x) * ratio;
      trajectory.push({ x: impactX, y: 0 });
      return { trajectory, range: impactX, flightTime: t, apex };
    }
    if (trajectory.length < 4000) trajectory.push({ x, y });
  }

  return { trajectory, range: x, flightTime: t, apex };
}
