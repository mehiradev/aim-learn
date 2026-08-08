/** Panneau des paramètres d'environnement — placé sous le simulateur. */
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAX_POWER, MIN_POWER } from "@/lib/ballistics/physics";
import { TARGET_MAX_DISTANCE, TARGET_MIN_DISTANCE } from "@/lib/ballistics/target";
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

export function SettingsPanel({ lab }: { lab: Lab }) {
  const { env } = lab;

  return (
    <div className="panel space-y-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">Paramètres</h2>
        <Button type="button" variant="outline" size="sm" onClick={lab.resetEnv} disabled={lab.flying}>
          <RotateCcw /> Réinitialiser
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="label-xs">Emplacement de la cible</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["random", "manual"] as const).map((m) => (
            <Button
              key={m}
              type="button"
              variant={lab.targetMode === m ? "default" : "outline"}
              aria-pressed={lab.targetMode === m}
              onClick={() => lab.setTargetMode(m)}
              disabled={lab.flying}
            >
              {m === "random" ? "Aléatoire" : "Manuel"}
            </Button>
          ))}
        </div>
      </div>

      {lab.targetMode === "manual" ? (
        <Row label="Distance de la cible" value={`${lab.target.distance.toFixed(1)} m`}>
          <Slider
            value={[lab.target.distance]}
            min={TARGET_MIN_DISTANCE}
            max={TARGET_MAX_DISTANCE}
            step={1}
            onValueChange={([v]) => lab.setTargetDistance(v ?? 300)}
          />
        </Row>
      ) : (
        <p className="label-xs">
          La cible est tirée au hasard entre {TARGET_MIN_DISTANCE} et {TARGET_MAX_DISTANCE} m à chaque « Nouvelle
          cible ».
        </p>
      )}

      <Row label="Gravité" value={`${env.gravity.toFixed(2)} m/s²`}>
        <Slider
          value={[env.gravity]}
          min={1}
          max={25}
          step={0.01}
          onValueChange={([v]) => lab.setEnv({ ...env, gravity: v ?? 9.81 })}
        />
      </Row>

      <Row label="Puissance du canon" value={`${(env.power / 1000).toFixed(1)} kJ`}>
        <Slider
          value={[env.power]}
          min={MIN_POWER}
          max={MAX_POWER}
          step={100}
          onValueChange={([v]) => lab.setEnv({ ...env, power: v ?? 10800 })}
        />
      </Row>
      <p className="label-xs">
        Énergie transmise au boulet : v₀ = √(2E/m) — {lab.initialSpeed.toFixed(1)} m/s avec le boulet sélectionné.
      </p>

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
  );
}
