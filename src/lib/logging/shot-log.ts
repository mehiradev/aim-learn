/** Traçabilité des tirs — enregistrement et lecture dans la base Lovable Cloud. */
import { supabase } from "@/integrations/supabase/client";

export interface ShotLogInput {
  mode: string;
  modelId: string | null;
  modelLabel: string | null;
  ballId: string;
  mass: number;
  angleDeg: number;
  power: number;
  speed: number;
  gravity: number;
  targetDistance: number;
  impactX: number;
  error: number;
  hit: boolean;
  flightTime: number;
  auto: boolean;
}

export interface ShotLogRow extends ShotLogInput {
  id: string;
  createdAt: string;
}

export async function logShot(input: ShotLogInput): Promise<void> {
  const { error } = await supabase.from("shot_logs").insert({
    mode: input.mode,
    model_id: input.modelId,
    model_label: input.modelLabel,
    ball_id: input.ballId,
    mass: input.mass,
    angle_deg: input.angleDeg,
    power: input.power,
    speed: input.speed,
    gravity: input.gravity,
    target_distance: input.targetDistance,
    impact_x: input.impactX,
    error: input.error,
    hit: input.hit,
    flight_time: input.flightTime,
    auto: input.auto,
  });
  if (error) console.error("Enregistrement du tir impossible :", error.message);
}

export async function fetchShotLogs(limit = 50): Promise<ShotLogRow[]> {
  const { data, error } = await supabase
    .from("shot_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Lecture de l'historique impossible :", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    mode: r.mode,
    modelId: r.model_id,
    modelLabel: r.model_label,
    ballId: r.ball_id,
    mass: r.mass,
    angleDeg: r.angle_deg,
    power: r.power,
    speed: r.speed,
    gravity: r.gravity,
    targetDistance: r.target_distance,
    impactX: r.impact_x,
    error: r.error,
    hit: r.hit,
    flightTime: r.flight_time,
    auto: r.auto,
  }));
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
