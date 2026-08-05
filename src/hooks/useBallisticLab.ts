/**
 * UI Controller (état) — orchestre physique, cible, ML et animation.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { DEFAULT_ENVIRONMENT, simulateShot, type Environment, type ShotResult } from "@/lib/ballistics/physics";
import { BALLS, type BallId } from "@/lib/ballistics/projectiles";
import { evaluateShot, generateTarget, type Target } from "@/lib/ballistics/target";
import { solve } from "@/lib/ml/solver";
import { trainModel, type TrainedModel, type TrainingMetrics } from "@/lib/ml/training";
import type { ModelId } from "@/lib/ml/registry";

export type Mode = "manual" | "learning" | "auto";

export interface ShotRecord {
  angleDeg: number;
  ballId: BallId;
  mass: number;
  speed: number;
  gravity: number;
  impactX: number;
  targetDistance: number;
  error: number;
  hit: boolean;
  flightTime: number;
  auto: boolean;
}

export interface ActiveShot {
  result: ShotResult;
  ballId: BallId;
  angleDeg: number;
  record: ShotRecord;
}

export function useBallisticLab() {
  const [mode, setMode] = useState<Mode>("manual");
  const [env, setEnv] = useState<Environment>(DEFAULT_ENVIRONMENT);
  const [ballId, setBallId] = useState<BallId>("medium");
  const [angle, setAngle] = useState(40);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1);

  const [target, setTarget] = useState<Target>(() => generateTarget());
  const [activeShot, setActiveShot] = useState<ActiveShot | null>(null);
  const [lastRecord, setLastRecord] = useState<ShotRecord | null>(null);
  const [history, setHistory] = useState<ShotRecord[]>([]);
  const [flying, setFlying] = useState(false);

  const [modelId, setModelId] = useState<ModelId>("ridge");
  const [trained, setTrained] = useState<TrainedModel | null>(null);
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liveMetrics, setLiveMetrics] = useState<TrainingMetrics | null>(null);
  const [trialCount, setTrialCount] = useState(600);

  const busy = useRef(false);

  const newTarget = useCallback(() => {
    setTarget(generateTarget());
    setActiveShot(null);
    setLastRecord(null);
  }, []);

  const fire = useCallback(
    (opts?: { ballId?: BallId; angleDeg?: number; auto?: boolean }) => {
      if (busy.current) return;
      const b = opts?.ballId ?? ballId;
      const a = opts?.angleDeg ?? angle;
      const ball = BALLS[b];
      const result = simulateShot({ angleDeg: a, mass: ball.mass }, env);
      const evaluation = evaluateShot(result.range, target);
      const record: ShotRecord = {
        angleDeg: a,
        ballId: b,
        mass: ball.mass,
        speed: env.initialSpeed,
        gravity: env.gravity,
        impactX: result.range,
        targetDistance: target.distance,
        error: evaluation.error,
        hit: evaluation.hit,
        flightTime: result.flightTime,
        auto: opts?.auto ?? false,
      };
      busy.current = true;
      setFlying(true);
      setLastRecord(null);
      setActiveShot({ result, ballId: b, angleDeg: a, record });
    },
    [angle, ballId, env, target],
  );

  const onImpact = useCallback(() => {
    busy.current = false;
    setFlying(false);
    setActiveShot((shot) => {
      if (shot) {
        setLastRecord(shot.record);
        setHistory((h) => [shot.record, ...h].slice(0, 20));
      }
      return shot;
    });
  }, []);

  const startTraining = useCallback(async () => {
    if (training) return;
    setTraining(true);
    setProgress(0);
    setLiveMetrics(null);
    try {
      const result = await trainModel({
        modelId,
        totalTrials: trialCount,
        batches: 12,
        env,
        halfWidth: target.halfWidth,
        onProgress: ({ progress: p, metrics }) => {
          setProgress(p);
          setLiveMetrics(metrics);
        },
      });
      setTrained(result);
      setLiveMetrics(result.metrics);
    } finally {
      setTraining(false);
    }
  }, [env, modelId, target.halfWidth, trialCount, training]);

  const autoShoot = useCallback(() => {
    if (!trained) return;
    const solution = solve(trained.model, target.distance, env);
    setBallId(solution.ballId);
    setAngle(Math.round(solution.angleDeg * 10) / 10);
    fire({ ballId: solution.ballId, angleDeg: solution.angleDeg, auto: true });
  }, [env, fire, target.distance, trained]);

  const previewRange = useMemo(
    () => simulateShot({ angleDeg: angle, mass: BALLS[ballId].mass }, env).range,
    [angle, ballId, env],
  );

  return {
    mode,
    setMode,
    env,
    setEnv,
    ballId,
    setBallId,
    angle,
    setAngle,
    showTrajectory,
    setShowTrajectory,
    animationSpeed,
    setAnimationSpeed,
    target,
    newTarget,
    activeShot,
    lastRecord,
    history,
    flying,
    fire,
    onImpact,
    modelId,
    setModelId,
    trained,
    training,
    progress,
    liveMetrics,
    trialCount,
    setTrialCount,
    startTraining,
    autoShoot,
    previewRange,
  };
}
