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
import { MODEL_OPTIONS, type ModelId } from "@/lib/ml/registry";
import { RL_HIDDEN_LAYERS } from "@/lib/ml/deep-rl";
import { fetchShotLogs, logShot, type ShotLogRow } from "@/lib/logging/shot-log";

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
  /** Mode de jeu au moment du tir */
  mode: string;
  /** Modèle d'IA utilisé (mode automatique) */
  modelId: ModelId | null;
  modelLabel: string | null;
  /** Date/heure ISO du tir */
  at: string;
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
      const auto = opts?.auto ?? false;
      const usedModelId = auto ? autoModelId : null;
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
        auto,
        mode,
        modelId: usedModelId,
        modelLabel: usedModelId ? (MODEL_OPTIONS.find((m) => m.id === usedModelId)?.label ?? usedModelId) : null,
        at: new Date().toISOString(),
      };
      busy.current = true;
      setFlying(true);
      setLastRecord(null);
      const shot: ActiveShot = { result, ballId: b, angleDeg: a, record };
      shotRef.current = shot;
      setActiveShot(shot);
    },
    [angle, autoModelId, ballId, env, mode, target],
  );

  const onImpact = useCallback(() => {
    if (!busy.current) return;
    busy.current = false;
    setFlying(false);
    const shot = shotRef.current;
    if (shot) {
      const r = shot.record;
      setLastRecord(r);
      setHistory((h) => [r, ...h].slice(0, 20));
      void logShot({
        mode: r.mode,
        modelId: r.modelId,
        modelLabel: r.modelLabel,
        ballId: r.ballId,
        mass: r.mass,
        angleDeg: r.angleDeg,
        power: r.power,
        speed: r.speed,
        gravity: r.gravity,
        targetDistance: r.targetDistance,
        impactX: r.impactX,
        error: r.error,
        hit: r.hit,
        flightTime: r.flightTime,
        auto: r.auto,
      }).then(refreshLogs);
    }
  }, [refreshLogs]);

  /**
   * Lance l'apprentissage.
   * mode "reset" : repart d'un réseau neuf. mode "continue" : affine le modèle existant.
   */
  const startTraining = useCallback(
    async (trainingMode: "reset" | "continue" = "reset") => {
      if (training) return;
      setTraining(true);
      setProgress(0);
      if (trainingMode === "reset") setLiveMetrics(null);
      try {
        const previous = trainingMode === "continue" ? (trainedModels[modelId] ?? null) : null;
        const result = await trainModel({
          modelId,
          totalTrials: trialCount,
          batches: 12,
          env,
          mass: BALLS[ballId].mass,
          halfWidth: target.halfWidth,
          rlConfig: { hiddenLayers, epochs: rlEpochs },
          previous,
          onProgress: ({ progress: p, metrics }) => {
            setProgress(p);
            setLiveMetrics(metrics);
          },
        });
        setTrainedModels((m) => ({ ...m, [modelId]: result }));
        setAutoModelId(modelId);
        setLiveMetrics(result.metrics);
      } finally {
        setTraining(false);
      }
    },
    [ballId, env, hiddenLayers, modelId, rlEpochs, target.halfWidth, trainedModels, trialCount, training],
  );

  const resetTraining = useCallback(() => {
    setTrainedModels((m) => ({ ...m, [modelId]: undefined }));
    setLiveMetrics(null);
    setProgress(0);
  }, [modelId]);

  const autoShoot = useCallback(() => {
    if (!autoTrained) return;
    const solution = solve(autoTrained.model, target.distance, env, ballId);
    setAutoSolution(solution);
    setBallId(solution.ballId);
    setAngle(Math.round(solution.angleDeg * 10) / 10);
    setEnv((e) => ({ ...e, power: Math.round(solution.power) }));
    fire({ ballId: solution.ballId, angleDeg: solution.angleDeg, power: solution.power, auto: true });
  }, [autoTrained, ballId, env, fire, target.distance]);


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
    trainedModels,
    autoModelId,
    setAutoModelId,
    autoTrained,
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
    resetTraining,
    autoShoot,
    previewRange,
    initialSpeed,
    resetEnv,
    modelStale,
    logs,
    refreshLogs,
  };

}
