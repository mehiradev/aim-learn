/** Tableau d'informations — état permanent de la simulation, du modèle et traçabilité. */
import { useState } from "react";
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
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const selectedLog = logs.find((log) => log.id === selectedLogId) ?? null;
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

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <h3 className="label-xs">Historique tracé (base de données)</h3>
          <Button size="sm" variant="ghost" onClick={() => void lab.refreshLogs()}>
            <RefreshCw className="size-4" /> Actualiser
          </Button>
        </div>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun tir enregistré pour le moment.</p>
        ) : (
          <>
            {selectedLog && (
              <div className="mb-3 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
                <div className="font-semibold">Sélection : {formatDateTime(selectedLog.createdAt)}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>Mode : {MODE_LABELS[selectedLog.mode] ?? selectedLog.mode}</div>
                  <div>Modèle : {selectedLog.modelLabel ?? '—'}</div>
                  <div>Angle : {selectedLog.angleDeg.toFixed(1)}°</div>
                  <div>Puissance : {(selectedLog.power / 1000).toFixed(1)} kJ</div>
                  <div>Cible : {selectedLog.targetDistance.toFixed(1)} m</div>
                  <div>Impact : {selectedLog.impactX.toFixed(1)} m</div>
                  <div>Écart : {selectedLog.error.toFixed(2)} m</div>
                  <div>{selectedLog.hit ? 'Tir réussi' : 'Tir manqué'}</div>
                </div>
              </div>
            )}
            <div className="max-h-72 overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[760px] border-collapse font-mono text-[11px]">
              <thead className="sticky top-0 bg-secondary/80 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Date / heure</th>
                  <th className="px-2 py-1.5 text-left font-medium">Mode</th>
                  <th className="px-2 py-1.5 text-left font-medium">Modèle</th>
                  <th className="px-2 py-1.5 text-left font-medium">Boulet</th>
                  <th className="px-2 py-1.5 text-right font-medium">Angle</th>
                  <th className="px-2 py-1.5 text-right font-medium">Puissance</th>
                  <th className="px-2 py-1.5 text-right font-medium">Cible</th>
                  <th className="px-2 py-1.5 text-right font-medium">Impact</th>
                  <th className="px-2 py-1.5 text-right font-medium">Écart</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((r) => {
                  const active = selectedLogId === r.id;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-border/60 transition-colors hover:bg-muted/40 hover:cursor-pointer ${
                        active ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => setSelectedLogId(r.id)}
                    >
                      <td className="px-2 py-1.5 text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{MODE_LABELS[r.mode] ?? r.mode}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.modelLabel ?? "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {BALLS[r.ballId as BallId]?.label.replace("Boulet ", "") ?? r.ballId} · {r.mass} kg
                      </td>
                      <td className="px-2 py-1.5 text-right">{r.angleDeg.toFixed(1)}°</td>
                      <td className="px-2 py-1.5 text-right">{(r.power / 1000).toFixed(1)} kJ</td>
                      <td className="px-2 py-1.5 text-right">{r.targetDistance.toFixed(1)} m</td>
                      <td className="px-2 py-1.5 text-right">{r.impactX.toFixed(1)} m</td>
                      <td className={`px-2 py-1.5 text-right ${r.hit ? "text-success" : "text-destructive"}`}>
                        {r.error >= 0 ? "+" : ""}
                        {r.error.toFixed(2)} m
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

    </div>
  );
}
