/** Panneau de contrôle — modes, boulet, angle, actions et apprentissage. */
import { Crosshair, Flame, GraduationCap, Play, RefreshCw, Sparkles, Hand, Brain, Bot, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { BALL_LIST, type BallId } from "@/lib/ballistics/projectiles";
import { MODEL_OPTIONS, type ModelId } from "@/lib/ml/registry";
import {
  RL_CRITIC_HIDDEN,
  RL_HIDDEN_LAYERS,
  RL_INPUT_NEURONS,
  RL_OUTPUT_NEURONS,
} from "@/lib/ml/deep-rl";
import type { useBallisticLab } from "@/hooks/useBallisticLab";

type Lab = ReturnType<typeof useBallisticLab>;

const MODES = [
  { id: "manual" as const, label: "Manuel", icon: Hand },
  { id: "learning" as const, label: "Apprentissage", icon: Brain },
  { id: "auto" as const, label: "Automatique", icon: Bot },
];

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="label-xs">{label}</Label>
        <span className="font-mono text-sm text-foreground">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function ControlPanel({ lab }: { lab: Lab }) {
  const { mode, trained } = lab;

  return (
    <div className="panel flex flex-col gap-5 p-5">
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <Button
              key={m.id}
              type="button"
              size="lg"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              className="h-auto flex-col gap-1 py-3"
              onClick={() => lab.setMode(m.id)}
            >
              <m.icon className="size-5" />
              <span className="text-xs font-semibold">{m.label}</span>
            </Button>
          );
        })}
      </div>

      {mode === "manual" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="label-xs">Type de boulet</Label>
            <div className="grid grid-cols-3 gap-2">
              {BALL_LIST.map((b) => (
                <button
                  key={b.id}
                  onClick={() => lab.setBallId(b.id as BallId)}
                  className={`rounded-lg border px-2 py-3 text-center transition-colors ${
                    lab.ballId === b.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <div className="text-xs font-semibold">{b.label.replace("Boulet ", "")}</div>
                  <div className="font-mono text-[11px] opacity-80">{b.mass} kg</div>
                </button>
              ))}
            </div>
          </div>

          <Row label="Angle de tir" value={`${lab.angle.toFixed(1)}°`}>
            <Slider
              value={[lab.angle]}
              min={30}
              max={89}
              step={0.5}
              onValueChange={([v]) => lab.setAngle(v ?? 45)}
            />
          </Row>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => lab.fire()} disabled={lab.flying}>
              <Flame /> Tirer
            </Button>
            <Button variant="secondary" onClick={lab.newTarget} disabled={lab.flying}>
              <Crosshair /> Nouvelle cible
            </Button>
          </div>
          <p className="label-xs">Portée estimée : {lab.previewRange.toFixed(1)} m</p>
        </div>
      )}

      {mode === "learning" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="label-xs">Algorithme d'apprentissage</Label>
            <div className="grid gap-2">
              {MODEL_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => lab.setModelId(m.id as ModelId)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    lab.modelId === m.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/60 hover:border-primary/50"
                  }`}
                >
                  <div className="text-sm font-semibold text-foreground">{m.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{m.description}</div>
                </button>
              ))}
            </div>
          </div>

          {lab.modelId === "deeprl" && (
            <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
              <h4 className="label-xs">Architecture du réseau</h4>
              <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
                <li>
                  Entrée : <span className="text-foreground">{RL_INPUT_NEURONS} neurones</span> — distance de la cible
                  et masse du boulet
                </li>
                <li>
                  Sortie : <span className="text-foreground">{RL_OUTPUT_NEURONS} neurones</span> — angle (30°–45°) et
                  puissance (1–60 kJ)
                </li>
                <li>
                  Critique : {RL_INPUT_NEURONS} → {RL_CRITIC_HIDDEN.join(" → ")} → 1 neurone (baseline)
                </li>
                <li className="text-accent">
                  Réseau : {RL_INPUT_NEURONS} → {lab.hiddenLayers.join(" → ")} → {RL_OUTPUT_NEURONS}
                </li>
              </ul>

              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <Label className="label-xs">Couches intermédiaires</Label>
                  <Button size="sm" variant="outline" onClick={lab.addLayer} disabled={lab.hiddenLayers.length >= 5}>
                    <Plus /> Ajouter
                  </Button>
                </div>
                {lab.hiddenLayers.map((n, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <Label className="label-xs">Couche {i + 1}</Label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-foreground">{n} neurones</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={`Supprimer la couche ${i + 1}`}
                          onClick={() => lab.removeLayer(i)}
                          disabled={lab.hiddenLayers.length <= 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <Slider
                      value={[n]}
                      min={1}
                      max={64}
                      step={1}
                      onValueChange={([v]) => lab.setLayerNeurons(i, v ?? n)}
                    />
                  </div>
                ))}
              </div>

              <Row label="Essais d'apprentissage (époques)" value={`${lab.rlEpochs}`}>
                <Slider
                  value={[lab.rlEpochs]}
                  min={10}
                  max={500}
                  step={10}
                  onValueChange={([v]) => lab.setRlEpochs(v ?? 140)}
                />
              </Row>
            </div>
          )}

          <Row label="Tirs d'essai à générer" value={`${lab.trialCount}`}>
            <Slider
              value={[lab.trialCount]}
              min={100}
              max={3000}
              step={100}
              onValueChange={([v]) => lab.setTrialCount(v ?? 600)}
            />
          </Row>


          <Button className="w-full" onClick={lab.startTraining} disabled={lab.training}>
            <GraduationCap /> {lab.training ? "Apprentissage en cours…" : "Lancer l'apprentissage"}
          </Button>

          {(lab.training || lab.liveMetrics) && (
            <div className="space-y-2">
              <Progress value={lab.progress * 100} />
              <p className="label-xs">
                Progression {Math.round(lab.progress * 100)}% — {lab.liveMetrics?.trials ?? 0} essais
              </p>
            </div>
          )}

          {lab.modelStale && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground">
              L'environnement a changé depuis le dernier entraînement. Relancez l'apprentissage pour que le modèle
              apprenne dans ces conditions.
            </p>
          )}

          {trained && (
            <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-xs text-foreground">
              Modèle « {MODEL_OPTIONS.find((m) => m.id === trained.modelId)?.label} » entraîné et gardé en mémoire.
              Le mode automatique est débloqué.
            </p>
          )}
        </div>
      )}

      {mode === "auto" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <div className="label-xs">Angle proposé</div>
              <div className="mt-1 font-mono text-sm text-primary">
                {lab.autoSolution ? `${lab.autoSolution.angleDeg.toFixed(1)}°` : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <div className="label-xs">Puissance proposée</div>
              <div className="mt-1 font-mono text-sm text-primary">
                {lab.autoSolution ? `${(lab.autoSolution.power / 1000).toFixed(1)} kJ` : "—"}
              </div>
            </div>
          </div>

          {!trained ? (
            <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
              Aucun modèle entraîné. Lancez d'abord un apprentissage.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Le réseau reçoit la distance de la cible et la masse du boulet choisi, puis en déduit l'angle et la
              puissance du canon.
            </p>
          )}

          <div className="space-y-2">
            <Label className="label-xs">Type de boulet</Label>
            <div className="grid grid-cols-3 gap-2">
              {BALL_LIST.map((b) => (
                <button
                  key={b.id}
                  onClick={() => lab.setBallId(b.id as BallId)}
                  className={`rounded-lg border px-2 py-3 text-center transition-colors ${
                    lab.ballId === b.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-secondary/60 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <div className="text-xs font-semibold">{b.label.replace("Boulet ", "")}</div>
                  <div className="font-mono text-[11px] opacity-80">{b.mass} kg</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={lab.autoShoot} disabled={!trained || lab.flying}>
              <Sparkles /> Tir automatique
            </Button>
            <Button variant="secondary" onClick={lab.newTarget} disabled={lab.flying}>
              <RefreshCw /> Nouvelle cible
            </Button>
          </div>
          {!trained && (
            <Button variant="outline" className="w-full" onClick={() => lab.setMode("learning")}>
              <Play /> Aller à l'apprentissage
            </Button>
          )}
        </div>
      )}

    </div>
  );
}
