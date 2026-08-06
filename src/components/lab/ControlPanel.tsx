/** Panneau de contrôle — modes, boulet, angle, actions, paramètres, apprentissage. */
import { Crosshair, Flame, GraduationCap, Play, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BALL_LIST, type BallId } from "@/lib/ballistics/projectiles";
import { MODEL_OPTIONS, type ModelId } from "@/lib/ml/registry";
import type { useBallisticLab } from "@/hooks/useBallisticLab";

type Lab = ReturnType<typeof useBallisticLab>;

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
  const { mode, env, trained } = lab;

  return (
    <div className="panel flex flex-col gap-5 p-5">
      <Tabs value={mode} onValueChange={(v) => lab.setMode(v as Lab["mode"])}>
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger value="manual">Manuel</TabsTrigger>
          <TabsTrigger value="learning">Apprentissage</TabsTrigger>
          <TabsTrigger value="auto">Automatique</TabsTrigger>
        </TabsList>
      </Tabs>

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
              min={1}
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
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <h4 className="label-xs">Architecture du réseau</h4>
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                <li>
                  Entrée : <span className="text-foreground">{RL_INPUT_NEURONS} neurones</span> — distance, masse,
                  vitesse, gravité, ratio d·g/v²
                </li>
                {RL_HIDDEN_LAYERS.map((n, i) => (
                  <li key={i}>
                    Couche cachée {i + 1} : <span className="text-foreground">{n} neurones</span> (tanh)
                  </li>
                ))}
                <li>
                  Sortie : <span className="text-foreground">{RL_OUTPUT_NEURONS} neurones</span> — μ (angle 5°–45°) et
                  log σ (exploration)
                </li>
                <li>
                  Critique : 5 → {RL_CRITIC_HIDDEN.join(" → ")} → 1 neurone (baseline)
                </li>
                <li className="text-accent">Récompense = −|portée − distance cible| / distance cible</li>
              </ul>
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
          {!trained ? (
            <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
              Aucun modèle entraîné. Lancez d'abord un apprentissage.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Le modèle choisit le boulet et l'angle, puis tire automatiquement sur la cible générée.
            </p>
          )}
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

      <div className="space-y-5 border-t border-border pt-5">
        <h3 className="label-xs">Paramètres</h3>
        <Row label="Gravité" value={`${env.gravity.toFixed(2)} m/s²`}>
          <Slider
            value={[env.gravity]}
            min={1}
            max={25}
            step={0.01}
            onValueChange={([v]) => lab.setEnv({ ...env, gravity: v ?? 9.81 })}
          />
        </Row>
        <Row label="Vitesse initiale" value={`${env.initialSpeed.toFixed(0)} m/s`}>
          <Slider
            value={[env.initialSpeed]}
            min={20}
            max={120}
            step={1}
            onValueChange={([v]) => lab.setEnv({ ...env, initialSpeed: v ?? 60 })}
          />
        </Row>
        <Row label="Vitesse d'animation" value={`${lab.animationSpeed.toFixed(1)}×`}>
          <Slider
            value={[lab.animationSpeed]}
            min={0.2}
            max={5}
            step={0.1}
            onValueChange={([v]) => lab.setAnimationSpeed(v ?? 1)}
          />
        </Row>
        <div className="flex items-center justify-between">
          <Label className="label-xs">Afficher la trajectoire</Label>
          <Switch checked={lab.showTrajectory} onCheckedChange={lab.setShowTrajectory} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="label-xs">Frottements de l'air</Label>
          <Switch checked={env.airDrag} onCheckedChange={(c) => lab.setEnv({ ...env, airDrag: c })} />
        </div>
      </div>
    </div>
  );
}
