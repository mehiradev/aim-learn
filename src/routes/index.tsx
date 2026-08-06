import { createFileRoute } from "@tanstack/react-router";
import { SimulationCanvas } from "@/components/lab/SimulationCanvas";
import { ControlPanel } from "@/components/lab/ControlPanel";
import { InfoPanel } from "@/components/lab/InfoPanel";
import { useBallisticLab } from "@/hooks/useBallisticLab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ballistic Lab — Simulateur de canon 2D & machine learning" },
      {
        name: "description",
        content:
          "Simulez des tirs de canon en 2D, réglez angle, boulet, gravité et vitesse, puis entraînez un modèle de machine learning à toucher la cible automatiquement.",
      },
      { property: "og:title", content: "Ballistic Lab — Simulateur de canon 2D & machine learning" },
      {
        property: "og:description",
        content:
          "Physique balistique en temps réel, mode manuel, apprentissage supervisé et tir automatique dans le navigateur.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BallisticLab,
});

function BallisticLab() {
  const lab = useBallisticLab();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Simulation balistique · machine learning</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ballistic&nbsp;<span className="text-primary">Lab</span>
          </h1>
        </div>
        <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 font-mono text-xs text-muted-foreground">
          mode : <span className="text-primary">{lab.mode}</span> · cible :{" "}
          <span className="text-accent">{lab.target.distance.toFixed(1)} m</span>
        </div>
      </header>

      <div className="space-y-5">
        <ControlPanel lab={lab} />
        <SimulationCanvas
          env={lab.env}
          target={lab.target}
          angleDeg={lab.angle}
          ballId={lab.ballId}
          showTrajectory={lab.showTrajectory}
          animationSpeed={lab.animationSpeed}
          activeShot={lab.activeShot}
          onImpact={lab.onImpact}
        />
        <InfoPanel lab={lab} />
      </div>
    </main>
  );
}
