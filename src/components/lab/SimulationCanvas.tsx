/** Zone de simulation — rendu canvas 2D : terrain, canon, cible, trajectoire, projectile. */
import { useEffect, useRef } from "react";
import type { Environment } from "@/lib/ballistics/physics";
import { BALLS, type BallId } from "@/lib/ballistics/projectiles";
import { VIEW_MAX_DISTANCE, type Target } from "@/lib/ballistics/target";
import type { ActiveShot } from "@/hooks/useBallisticLab";

interface Props {
  env: Environment;
  target: Target;
  angleDeg: number;
  ballId: BallId;
  showTrajectory: boolean;
  animationSpeed: number;
  activeShot: ActiveShot | null;
  onImpact: () => void;
}

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function SimulationCanvas({
  env,
  target,
  angleDeg,
  ballId,
  showTrajectory,
  animationSpeed,
  activeShot,
  onImpact,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startRef = useRef<number | null>(null);
  const shotRef = useRef<ActiveShot | null>(null);
  const doneRef = useRef(false);
  const impactRef = useRef(onImpact);
  impactRef.current = onImpact;

  useEffect(() => {
    shotRef.current = activeShot;
    startRef.current = null;
    doneRef.current = !activeShot;
  }, [activeShot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const colors = {
      grid: cssVar("--grid", "#3a4152"),
      ground: cssVar("--muted", "#2b3040"),
      fg: cssVar("--foreground", "#f2f4f8"),
      muted: cssVar("--muted-foreground", "#9aa3b2"),
      primary: cssVar("--primary", "#f08a3c"),
      accent: cssVar("--accent", "#5ec9df"),
      success: cssVar("--success", "#4fc98c"),
      destructive: cssVar("--destructive", "#e05252"),
    };

    const draw = (now: number) => {
      const parent = canvas.parentElement;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent ? parent.clientWidth : 800;
      const h = parent ? parent.clientHeight : 420;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const shot = shotRef.current;
      const padLeft = 42;
      const padRight = 24;
      const groundY = h - 46;
      // étendue horizontale fixe : le terrain affiche toujours 0 → 550 m
      const maxX = VIEW_MAX_DISTANCE;
      const maxY = Math.max(shot ? shot.result.apex * 1.35 : 0, 60);
      const sx = (w - padLeft - padRight) / maxX;
      const sy = Math.min(sx, (groundY - 26) / maxY);
      const toPx = (x: number, y: number) => ({ px: padLeft + x * sx, py: groundY - y * sy });

      // --- grille technique ---
      ctx.strokeStyle = colors.grid;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      const stepM = maxX > 500 ? 100 : maxX > 250 ? 50 : 25;
      ctx.font = "10px ui-monospace, monospace";
      for (let x = 0; x <= maxX; x += stepM) {
        const { px } = toPx(x, 0);
        ctx.beginPath();
        ctx.moveTo(px, 16);
        ctx.lineTo(px, groundY);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = colors.muted;
        ctx.fillText(`${x}m`, px + 3, groundY + 16);
        ctx.globalAlpha = 0.4;
      }
      for (let y = stepM; y <= maxY; y += stepM) {
        const { py } = toPx(0, y);
        if (py < 14) break;
        ctx.beginPath();
        ctx.moveTo(padLeft, py);
        ctx.lineTo(w - padRight, py);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = colors.muted;
        ctx.fillText(`${y}m`, 6, py + 3);
        ctx.globalAlpha = 0.4;
      }
      ctx.globalAlpha = 1;

      // --- sol ---
      ctx.fillStyle = colors.ground;
      ctx.fillRect(0, groundY, w, h - groundY);
      ctx.strokeStyle = colors.fg;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, groundY + 0.5);
      ctx.lineTo(w, groundY + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // --- cible ---
      const targetPx = toPx(target.distance, 0).px;
      const halfPx = Math.max(4, target.halfWidth * sx);
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(targetPx - halfPx, groundY - 46, halfPx * 2, 46);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(targetPx, groundY);
      ctx.lineTo(targetPx, groundY - 46);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(targetPx, groundY - 52, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(targetPx, groundY - 52, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = colors.accent;
      ctx.fill();

      // étiquette : distance de la cible
      const labelText = `Cible ${target.distance.toFixed(1)} m`;
      ctx.font = "600 12px ui-monospace, monospace";
      const labelW = ctx.measureText(labelText).width + 12;
      const labelX = Math.min(Math.max(targetPx - labelW / 2, 4), w - labelW - 4);
      const labelY = groundY - 82;
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(labelX, labelY, labelW, 20);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(labelX + 0.5, labelY + 0.5, labelW - 1, 19);
      ctx.fillStyle = colors.accent;
      ctx.fillText(labelText, labelX + 6, labelY + 14);

      // cotation au sol canon → cible
      ctx.strokeStyle = colors.accent;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, groundY + 26);
      ctx.lineTo(targetPx, groundY + 26);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = "10px ui-monospace, monospace";
      const dText = `${target.distance.toFixed(1)} m`;
      const dW = ctx.measureText(dText).width;
      ctx.fillStyle = colors.accent;
      ctx.fillText(dText, Math.max(4, (padLeft + targetPx) / 2 - dW / 2), groundY + 38);

      // --- canon (fût trapézoïdal sur affût à roue) ---
      const baseX = padLeft;
      const pivotY = groundY - 16;
      const drawAngle = shot ? shot.angleDeg : angleDeg;
      const rad = (drawAngle * Math.PI) / 180;
      const barrel = 40;
      const ux = Math.cos(rad);
      const uy = -Math.sin(rad);
      const nx = -uy;
      const ny = ux;
      const rBack = 7;
      const rFront = 4.5;

      ctx.save();
      // affût (châssis triangulaire)
      ctx.fillStyle = colors.ground;
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(baseX - 16, groundY);
      ctx.lineTo(baseX + 18, groundY);
      ctx.lineTo(baseX + 4, pivotY - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // fût : trapèze (large à la culasse, étroit à la bouche)
      ctx.fillStyle = colors.primary;
      ctx.beginPath();
      ctx.moveTo(baseX + nx * rBack, pivotY + ny * rBack);
      ctx.lineTo(baseX + ux * barrel + nx * rFront, pivotY + uy * barrel + ny * rFront);
      ctx.lineTo(baseX + ux * barrel - nx * rFront, pivotY + uy * barrel - ny * rFront);
      ctx.lineTo(baseX - nx * rBack, pivotY - ny * rBack);
      ctx.closePath();
      ctx.fill();

      // bourrelet de bouche
      ctx.lineWidth = 3;
      ctx.strokeStyle = colors.primary;
      ctx.beginPath();
      ctx.moveTo(baseX + ux * (barrel - 4) + nx * (rFront + 2), pivotY + uy * (barrel - 4) + ny * (rFront + 2));
      ctx.lineTo(baseX + ux * (barrel - 4) - nx * (rFront + 2), pivotY + uy * (barrel - 4) - ny * (rFront + 2));
      ctx.stroke();

      // culasse plate
      ctx.beginPath();
      ctx.moveTo(baseX + nx * rBack, pivotY + ny * rBack);
      ctx.lineTo(baseX - nx * rBack, pivotY - ny * rBack);
      ctx.lineWidth = 4;
      ctx.stroke();

      // roue
      ctx.beginPath();
      ctx.arc(baseX + 2, groundY - 8, 9, 0, Math.PI * 2);
      ctx.fillStyle = colors.ground;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.primary;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(baseX - 5, groundY - 8);
      ctx.lineTo(baseX + 9, groundY - 8);
      ctx.moveTo(baseX + 2, groundY - 15);
      ctx.lineTo(baseX + 2, groundY - 1);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // --- trajectoire + projectile ---
      if (shot) {
        if (startRef.current === null) startRef.current = now;
        const elapsed = ((now - startRef.current) / 1000) * animationSpeed;
        const t = Math.min(1, shot.result.flightTime > 0 ? elapsed / shot.result.flightTime : 1);
        const pts = shot.result.trajectory;
        const idx = Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)));

        if (showTrajectory) {
          ctx.strokeStyle = colors.primary;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          pts.forEach((p, i) => {
            const { px, py } = toPx(p.x, p.y);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }

        // trace parcourue
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= idx; i++) {
          const p = pts[i]!;
          const { px, py } = toPx(p.x, p.y);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        const cur = pts[idx]!;
        const { px, py } = toPx(cur.x, cur.y);
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = 16;
        ctx.fillStyle = colors.primary;
        ctx.beginPath();
        ctx.arc(px, py, BALLS[shot.ballId].radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (t >= 1) {
          // marqueur d'impact
          const impact = toPx(shot.result.range, 0);
          ctx.strokeStyle = shot.record.hit ? colors.success : colors.destructive;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(impact.px - 8, groundY - 8);
          ctx.lineTo(impact.px + 8, groundY + 8);
          ctx.moveTo(impact.px + 8, groundY - 8);
          ctx.lineTo(impact.px - 8, groundY + 8);
          ctx.stroke();
          if (!doneRef.current) {
            doneRef.current = true;
            impactRef.current();
          }
        }
      } else if (showTrajectory) {
        // aperçu de la visée
        ctx.strokeStyle = colors.muted;
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(baseX, groundY - 8);
        ctx.lineTo(
          baseX + Math.cos((drawAngle * Math.PI) / 180) * 160,
          groundY - 8 - Math.sin((drawAngle * Math.PI) / 180) * 160,
        );
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [env, target, angleDeg, ballId, showTrajectory, animationSpeed]);

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-xl border border-border bg-surface sm:h-[420px]">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
