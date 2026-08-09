/** Tableau d'informations — état permanent de la simulation, du modèle et traçabilité. */
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BALLS, type BallId } from "@/lib/ballistics/projectiles";
import { formatDateTime } from "@/lib/logging/shot-log";
import { MODEL_OPTIONS } from "@/lib/ml/registry";
import type { useBallisticLab } from "@/hooks/useBallisticLab";

type Lab = ReturnType<typeof useBallisticLab>;

const MODE_LABELS: Record<string, string> = {
  manual: "Manuel",
  learning: "Apprentissage",
  auto: "Automatique",
};

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "ok" | "bad" }) {
  const color = tone === "ok" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <div className="label-xs">{label}</div>
      <div className={`mt-1 font-mono text-sm ${color}`}>{value}</div>
    </div>
  );
}

export function InfoPanel({ lab }: { lab: Lab }) {
  const { lastRecord, target, env, liveMetrics, trained, autoTrained, logs } = lab;
  const metrics = trained?.metrics ?? liveMetrics;
  const shownModel = lab.mode === "auto" ? autoTrained : trained;
  const shownModelLabel = shownModel
    ? (MODEL_OPTIONS.find((m) => m.id === shownModel.modelId)?.label ?? shownModel.modelId)
    : "aucun";

  return (
    <div className="panel space-y-4 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-foreground">Tableau d'informations</h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Mode en cours" value={MODE_LABELS[lab.mode] ?? lab.mode} />
        <Stat label="Modèle choisi" value={shownModelLabel} />
        <Stat label="Entraîné le" value={shownModel ? formatDateTime(shownModel.trainedAt) : "—"} />
        <Stat label="Sessions d'apprentissage" value={shownModel ? `${shownModel.sessions}` : "—"} />
        <Stat label="Angle" value={`${lab.angle.toFixed(1)}°`} />
        <Stat label="Masse" value={`${BALLS[lab.ballId].mass} kg`} />
        <Stat label="Puissance" value={`${(env.power / 1000).toFixed(1)} kJ`} />
        <Stat label="Vitesse initiale" value={`${lab.initialSpeed.toFixed(1)} m/s`} />
        <Stat label="Gravité" value={`${env.gravity.toFixed(2)} m/s²`} />
        <Stat label="Distance cible" value={`${target.distance.toFixed(1)} m`} />
        <Stat label="Distance impact" value={lastRecord ? `${lastRecord.impactX.toFixed(1)} m` : "—"} />
        <Stat
          label="Erreur"
          value={lastRecord ? `${lastRecord.error >= 0 ? "+" : ""}${lastRecord.error.toFixed(2)} m` : "—"}
          tone={lastRecord ? (lastRecord.hit ? "ok" : "bad") : "default"}
        />
        <Stat label="Dernier tir" value={lastRecord ? formatDateTime(lastRecord.at) : "—"} />
        <Stat label="Essais d'apprentissage" value={metrics ? `${metrics.trials}` : "0"} />
        <Stat label="Précision modèle" value={metrics ? `${(metrics.hitRate * 100).toFixed(0)} %` : "—"} />
        <Stat label="Tirs tracés en base" value={`${logs.length}`} />
      </div>


      {lastRecord && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            lastRecord.hit ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
          }`}
        >
          <span className="font-semibold">{lastRecord.hit ? "Cible touchée" : "Tir manqué"}</span>{" "}
          <span className="text-muted-foreground">
            — {lastRecord.auto ? "tir automatique" : "tir manuel"}, {BALLS[lastRecord.ballId].label.toLowerCase()},
            angle {lastRecord.angleDeg.toFixed(1)}°, temps de vol {lastRecord.flightTime.toFixed(2)} s, écart{" "}
            {Math.abs(lastRecord.error).toFixed(2)} m.
          </span>
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 sm:grid-cols-4">
          <Stat label="Angle moyen prédit" value={`${metrics.avgAngle.toFixed(1)}°`} />
          <Stat label="Puissance moyenne" value={`${(metrics.avgPower / 1000).toFixed(1)} kJ`} />
          <Stat label="Erreur distance moy." value={`${metrics.distanceMae.toFixed(2)} m`} />
          <Stat label="Qualité (R²)" value={metrics.r2.toFixed(3)} />
          <Stat label="Taux de réussite" value={`${(metrics.hitRate * 100).toFixed(0)} %`} />
        </div>
      )}

      {lab.history.length > 0 && (
        <div className="space-y-1 border-t border-border pt-4">
          <h3 className="label-xs">Derniers tirs</h3>
          <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
            {lab.history.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-1.5 font-mono text-xs"
              >
                <span className="text-muted-foreground">
                  {r.angleDeg.toFixed(1)}° · {r.mass}kg · {r.auto ? "auto" : "man"}
                </span>
                <span className={r.hit ? "text-success" : "text-destructive"}>
                  {r.error >= 0 ? "+" : ""}
                  {r.error.toFixed(2)} m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
