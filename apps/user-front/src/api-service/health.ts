import { config } from "@repo/config";

/**
 * Sonde de disponibilité de l'api. Ping l'endpoint public /health et renvoie false sur toute
 * erreur réseau ou réponse non-2xx — sert à afficher une page 500 plutôt qu'une app vide et
 * cassée quand l'api est indisponible.
 *
 * @param timeoutMs délai avant abandon (via AbortController), 5 s par défaut.
 */
export async function checkApiHealth(timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.apiUrl}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
