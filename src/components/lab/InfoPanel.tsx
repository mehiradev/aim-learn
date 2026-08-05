/** Tableau d'informations — état permanent de la simulation et du modèle. */
import { BALLS } from "@/lib/ballistics/projectiles";
import type { useBallisticLab } from "@/hooks/useBallisticLab";

type Lab = ReturnType<typeof useBallisticLab>;

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
  const { lastRecord, target, env, liveMetrics, trained } = lab;
  const metrics = trained?.metrics ?? liveMetrics;

  return (
    <div className="panel space-y-4 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-foreground">Tableau d'informations</h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Angle" value={`${lab.angle.toFixed(1)}°`} />
        <Stat label="Masse" value={`${BALLS[lab.ballId].mass} kg`} />
        <Stat label="Vitesse" value={`${env.initialSpeed.toFixed(0)} m/s`} />
        <Stat label="Gravité" value={`${env.gravity.toFixed(2)} m/s²`} />
        <Stat label="Distance cible" value={`${target.distance.toFixed(1)} m`} />
        <Stat label="Distance impact" value={lastRecord ? `${lastRecord.impactX.toFixed(1)} m` : "—"} />
        <Stat
          label="Erreur"
          value={lastRecord ? `${lastRecord.error >= 0 ? "+" : ""}${lastRecord.error.toFixed(2)} m` : "—"}
          tone={lastRecord ? (lastRecord.hit ? "ok" : "bad") : "default"}
        />
        <Stat label="Essais d'apprentissage" value={metrics ? `${metrics.trials}` : "0"} />
        <Stat label="Précision modèle" value={metrics ? `${(metrics.hitRate * 100).toFixed(0)} %` : "—"} />
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
          <Stat label="Erreur angle moy." value={`${metrics.angleMae.toFixed(2)}°`} />
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
