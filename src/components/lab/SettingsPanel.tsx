/** Panneau des paramètres d'environnement — placé sous le simulateur. */
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { MAX_POWER, MIN_POWER } from "@/lib/ballistics/physics";
import { TARGET_MAX_DISTANCE, TARGET_MIN_DISTANCE } from "@/lib/ballistics/target";
import { getApiKey, listApiKeysFn, revokeApiKeyFn } from "@/lib/api/ml.functions";
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
  const [apiPassword, setApiPassword] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [apiKeys, setApiKeys] = useState<{
    id: string;
    label: string;
    createdAt: string;
    revoked: boolean;
    revokedAt: string | null;
    lastUsedAt: string | null;
  }[]>([]);
  const [apiKeyListError, setApiKeyListError] = useState<string | null>(null);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);

  const handleCreateApiKey = async () => {
    setApiError(null);
    setApiKey(null);
    setCreatingApiKey(true);

    try {
      const result = await getApiKey({ data: { password: apiPassword } });
      setApiKey(result.apiKey);
      void refreshApiKeys();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Erreur inconnue");
    } finally {
      setCreatingApiKey(false);
    }
  };

  const refreshApiKeys = async () => {
    setApiKeyListError(null);
    setLoadingApiKeys(true);
    try {
      if (!apiPassword) {
        throw new Error('Saisissez le mot de passe secret pour charger les clés.');
      }
      const result = await listApiKeysFn({ data: { password: apiPassword } });
      setApiKeys(result.apiKeys);
    } catch (error) {
      setApiKeyListError(error instanceof Error ? error.message : "Erreur inconnue");
      setApiKeys([]);
    } finally {
      setLoadingApiKeys(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    setApiKeyListError(null);
    try {
      await revokeApiKeyFn({ data: { key: id, password: apiPassword } });
      void refreshApiKeys();
    } catch (error) {
      setApiKeyListError(error instanceof Error ? error.message : "Erreur inconnue");
    }
  };

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

      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <div className="label-xs">Créer une clé API</div>
            <p className="text-xs text-muted-foreground">
              Saisissez le mot de passe secret pour générer la clé API.
            </p>
          </div>
          <a
            href="/API-prompt.md"
            download
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Télécharger API-prompt.md
          </a>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            type="password"
            value={apiPassword}
            onChange={(event) => setApiPassword(event.target.value)}
            placeholder="Mot de passe API"
            aria-label="Mot de passe API"
          />
          <Button
            type="button"
            onClick={handleCreateApiKey}
            disabled={creatingApiKey || apiPassword.length === 0}
          >
            Générer
          </Button>
        </div>
        {apiKey && (
          <div className="mt-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
            <div className="font-semibold">Clé API générée</div>
            <div className="mt-1 font-mono break-all">{apiKey}</div>
          </div>
        )}
        {apiError && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {apiError}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <div className="label-xs">Clés API existantes</div>
              <p className="text-xs text-muted-foreground">
                La liste est affichée en partie masquée. Vous pouvez révoquer une clé si nécessaire.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshApiKeys}
              disabled={loadingApiKeys || apiPassword.length === 0}
            >
              Actualiser
            </Button>
          </div>
          {apiKeyListError && (
            <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {apiKeyListError}
            </div>
          )}
          {apiKeys.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucune clé API chargée. Générer une clé ou saisir le mot de passe pour afficher la liste.
            </p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((record) => {
                const mask = record.revoked
                  ? '🔒 clé révoquée'
                  : `${record.id.slice(0, 6)}…${record.id.slice(-6)}`;
                return (
                  <div key={record.id} className="rounded-lg border border-border bg-background/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono text-sm break-all">
                        {record.label ? `${record.label} · ${mask}` : mask}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeApiKey(record.id)}
                          disabled={record.revoked}
                        >
                          Révoquer
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Créée le {new Date(record.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {record.lastUsedAt && (
                          <span>Dernière utilisation le {new Date(record.lastUsedAt).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</span>
                        )}
                        {record.revoked && <span className="text-destructive">Révoquée</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
