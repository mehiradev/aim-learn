/**
 * UI Controller (état) — orchestre physique, cible, ML et animation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ENVIRONMENT,
  simulateShot,
  speedFromPower,
  type Environment,
  type ShotResult,
} from "@/lib/ballistics/physics";
import { BALLS, type BallId } from "@/lib/ballistics/projectiles";
import { evaluateShot, generateTarget, INITIAL_TARGET, type Target } from "@/lib/ballistics/target";
import type { Solution } from "@/lib/ml/solver";
import { solve } from "@/lib/ml/solver";
import { trainModel, type TrainedModel, type TrainingMetrics } from "@/lib/ml/training";
import type { ModelId } from "@/lib/ml/registry";
import { RL_HIDDEN_LAYERS } from "@/lib/ml/deep-rl";

export type Mode = "manual" | "learning" | "auto";
export type TargetMode = "random" | "manual";

export interface ShotRecord {
  angleDeg: number;
  ballId: BallId;
  mass: number;
  power: number;
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

  const [target, setTarget] = useState<Target>(INITIAL_TARGET);
  const [targetMode, setTargetMode] = useState<TargetMode>("random");
  const [autoSolution, setAutoSolution] = useState<Solution | null>(null);
  const [activeShot, setActiveShot] = useState<ActiveShot | null>(null);
  const [lastRecord, setLastRecord] = useState<ShotRecord | null>(null);
  const [history, setHistory] = useState<ShotRecord[]>([]);
  const [flying, setFlying] = useState(false);

  const [modelId, setModelId] = useState<ModelId>("deeprl");
  /** Modèles entraînés conservés par algorithme (le mode auto peut choisir). */
  const [trainedModels, setTrainedModels] = useState<Partial<Record<ModelId, TrainedModel>>>({});
  const [autoModelId, setAutoModelId] = useState<ModelId>("deeprl");
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liveMetrics, setLiveMetrics] = useState<TrainingMetrics | null>(null);
  const [trialCount, setTrialCount] = useState(1200);
  const [hiddenLayers, setHiddenLayers] = useState<number[]>([...RL_HIDDEN_LAYERS]);
  const [rlEpochs, setRlEpochs] = useState(140);
  const [logs, setLogs] = useState<ShotLogRow[]>([]);

  const trained = trainedModels[modelId] ?? null;
  const autoTrained = trainedModels[autoModelId] ?? null;

  const refreshLogs = useCallback(async () => {
    setLogs(await fetchShotLogs(50));
  }, []);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);


  const setLayerNeurons = useCallback((index: number, neurons: number) => {
    setHiddenLayers((l) => l.map((n, i) => (i === index ? Math.max(1, Math.min(64, Math.round(neurons))) : n)));
  }, []);
  const addLayer = useCallback(() => {
    setHiddenLayers((l) => (l.length >= 5 ? l : [...l, 8]));
  }, []);
  const removeLayer = useCallback((index: number) => {
    setHiddenLayers((l) => (l.length <= 1 ? l : l.filter((_, i) => i !== index)));
  }, []);

  // Cible aléatoire générée après hydratation (évite un écart serveur/client)
  useEffect(() => {
    setTarget(generateTarget());
  }, []);

  const setTargetDistance = useCallback((distance: number) => {
    setTarget((t) => ({ ...t, distance: Math.round(distance * 10) / 10 }));
    setActiveShot(null);
    setLastRecord(null);
  }, []);

  const busy = useRef(false);
  const shotRef = useRef<ActiveShot | null>(null);

  const newTarget = useCallback(() => {
    if (targetMode === "random") setTarget(generateTarget());
    setActiveShot(null);
    setLastRecord(null);
  }, [targetMode]);

  const fire = useCallback(
    (opts?: { ballId?: BallId; angleDeg?: number; power?: number; auto?: boolean }) => {
      if (busy.current) return;
      const b = opts?.ballId ?? ballId;
      const a = opts?.angleDeg ?? angle;
      const p = opts?.power ?? env.power;
      const ball = BALLS[b];
      const shotEnv: Environment = { ...env, power: p };
      const result = simulateShot({ angleDeg: a, mass: ball.mass }, shotEnv);
      const evaluation = evaluateShot(result.range, target);
      const record: ShotRecord = {
        angleDeg: a,
        ballId: b,
        mass: ball.mass,
        power: p,
        speed: result.initialSpeed,
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
      const shot: ActiveShot = { result, ballId: b, angleDeg: a, record };
      shotRef.current = shot;
      setActiveShot(shot);
    },
    [angle, ballId, env, target],
  );

  const onImpact = useCallback(() => {
    if (!busy.current) return;
    busy.current = false;
    setFlying(false);
    const shot = shotRef.current;
    if (shot) {
      setLastRecord(shot.record);
      setHistory((h) => [shot.record, ...h].slice(0, 20));
    }
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
        mass: BALLS[ballId].mass,
        halfWidth: target.halfWidth,
        rlConfig: { hiddenLayers, epochs: rlEpochs },
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
  }, [ballId, env, hiddenLayers, modelId, rlEpochs, target.halfWidth, trialCount, training]);

  const autoShoot = useCallback(() => {
    if (!trained) return;
    const solution = solve(trained.model, target.distance, env, ballId);
    setAutoSolution(solution);
    setBallId(solution.ballId);
    setAngle(Math.round(solution.angleDeg * 10) / 10);
    setEnv((e) => ({ ...e, power: Math.round(solution.power) }));
    fire({ ballId: solution.ballId, angleDeg: solution.angleDeg, power: solution.power, auto: true });
  }, [ballId, env, fire, target.distance, trained]);

  const resetEnv = useCallback(() => {
    setEnv(DEFAULT_ENVIRONMENT);
    setAnimationSpeed(1);
    setShowTrajectory(true);
  }, []);

  /** Le modèle a-t-il été entraîné dans un environnement différent de l'actuel ? */
  const modelStale = useMemo(
    () =>
      !!trained &&
      (trained.env.gravity !== env.gravity ||
        trained.env.airDrag !== env.airDrag ||
        trained.env.dragCoefficient !== env.dragCoefficient),
    [env, trained],
  );

  const previewRange = useMemo(
    () => simulateShot({ angleDeg: angle, mass: BALLS[ballId].mass }, env).range,
    [angle, ballId, env],
  );

  const initialSpeed = useMemo(() => speedFromPower(env.power, BALLS[ballId].mass), [ballId, env.power]);

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
    targetMode,
    setTargetMode,
    setTargetDistance,
    newTarget,
    autoSolution,
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
    hiddenLayers,
    setLayerNeurons,
    addLayer,
    removeLayer,
    rlEpochs,
    setRlEpochs,
    startTraining,
    autoShoot,
    previewRange,
    initialSpeed,
    resetEnv,
    modelStale,
  };
}
