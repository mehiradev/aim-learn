/** Informations de build — version applicative et date de compilation. */
declare const __BUILD_DATE__: string;
declare const __APP_VERSION__: string;

/** Version de l'application injectée par Vite au build. */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

/** Date/heure de la compilation, injectée par Vite au build. */
export const BUILD_DATE: string =
  typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : new Date(0).toISOString();

export function formatBuildDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
