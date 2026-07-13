import { config } from "@repo/config";

// Pings the api's public /health endpoint. Returns false on any network error or
// non-2xx — used to show a 500 page instead of a broken empty app when the api is down.
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
