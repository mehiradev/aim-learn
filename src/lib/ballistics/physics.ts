/**
 * Physics Engine — moteur balistique 2D simple et pédagogique.
 * Aucune dépendance à l'UI ou au machine learning.
 *
 * Le canon est réglé en PUISSANCE (joules) : l'énergie cinétique communiquée
 * au boulet. La vitesse initiale en découle : E = ½·m·v²  ⇒  v = √(2E/m).
 * Un boulet lourd part donc moins vite qu'un boulet léger à puissance égale.
 */

export interface Environment {
  /** Gravité en m/s² (positive, vers le bas) */
  gravity: number;
  /** Puissance du canon en joules (énergie cinétique transmise au boulet) */
  power: number;
  /** Frottements de l'air activés ou non */
  airDrag: boolean;
  /** Coefficient de frottement (F = -k * |v| * v) */
  dragCoefficient: number;
}

export const MIN_POWER = 1000;
export const MAX_POWER = 60000;

export const DEFAULT_ENVIRONMENT: Environment = {
  gravity: 9.81,
  power: 10800,
  airDrag: false,
  dragCoefficient: 0.02,
};

/** Vitesse initiale (m/s) déduite de la puissance et de la masse du boulet. */
export function speedFromPower(power: number, mass: number): number {
  return Math.sqrt((2 * Math.max(0, power)) / Math.max(0.001, mass));
}

/** Puissance (J) nécessaire pour communiquer une vitesse donnée à une masse. */
export function powerFromSpeed(speed: number, mass: number): number {
  return 0.5 * mass * speed * speed;
}

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
  /** Vitesse initiale effective (m/s) */
  initialSpeed: number;
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
 */
export function analyticRange(angleDeg: number, speed: number, gravity: number): number {
  return (speed * speed * Math.sin(2 * angleDeg * DEG)) / gravity;
}

/**
 * Simule un tir et renvoie sa trajectoire échantillonnée.
 * Sans frottement : équations classiques du mouvement.
 * Avec frottement : intégration d'Euler semi-implicite.
 */
export function simulateShot(params: ShotParams, env: Environment): ShotResult {
  const { angleDeg, mass } = params;
  const theta = angleDeg * DEG;
  const v0 = speedFromPower(env.power, mass);
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
    return { trajectory, range, flightTime: Math.max(flightTime, 0), apex, initialSpeed: v0 };
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
      const ratio = prevY / (prevY - y || 1);
      const prevX = trajectory[trajectory.length - 1]?.x ?? x;
      const impactX = prevX + (x - prevX) * ratio;
      trajectory.push({ x: impactX, y: 0 });
      return { trajectory, range: impactX, flightTime: t, apex, initialSpeed: v0 };
    }
    if (trajectory.length < 4000) trajectory.push({ x, y });
  }

  return { trajectory, range: x, flightTime: t, apex, initialSpeed: v0 };
}
