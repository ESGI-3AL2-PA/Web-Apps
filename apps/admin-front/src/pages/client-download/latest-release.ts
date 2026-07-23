// Utilitaires de récupération de la dernière release du client desktop JavaFX (admin-desktop).
// Résout, via l'API GitHub, l'URL de téléchargement des JARs par OS et de l'installeur .exe Windows,
// avec des URLs statiques de repli quand l'API GitHub est injoignable.

// Le client desktop JavaFX est publié depuis un dépôt séparé de la même organisation.
// Les coordonnées sont fixes (indépendantes de l'environnement), d'où leur présence ici
// plutôt que dans @repo/config.
const REPO = "ESGI-3AL2-PA/Client-Java";

export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

// Les fat JARs ont des noms d'assets fixes : ils se résolvent donc à une URL statique "latest"
// même quand l'API des releases est injoignable — le composant se rabat sur celles-ci.
export const JARS = [
  { os: "windows", icon: "icon-[tabler--brand-windows]", asset: "admin-desktop-windows.jar" },
  { os: "linux", icon: "icon-[tabler--brand-debian]", asset: "admin-desktop-linux.jar" },
  { os: "macos", icon: "icon-[tabler--brand-apple]", asset: "admin-desktop-macos.jar" },
] as const;

/** URL de téléchargement statique "latest" d'un asset JAR, utilisée en repli quand l'API échoue. */
export const staticJarUrl = (asset: string): string => `https://github.com/${REPO}/releases/latest/download/${asset}`;

/** Vue normalisée d'une release renvoyée par {@link fetchLatestRelease}. */
export interface LatestRelease {
  version: string;
  publishedAt: string;
  htmlUrl: string;
  // Le nom de l'installeur Windows porte le numéro de version : son URL n'est donc connaissable
  // que via l'API.
  exeUrl: string | null;
  // os -> browser_download_url, résolu depuis l'API (les boutons JAR se rabattent sur staticJarUrl).
  jarUrls: Record<string, string>;
}

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
  assets: GithubAsset[];
}

/**
 * Interroge l'API GitHub pour la dernière release et en extrait version, date, lien,
 * installeur .exe et URLs des JARs par OS.
 * @param signal AbortSignal optionnel pour annuler la requête (démontage du composant).
 * @throws Error si la réponse HTTP n'est pas OK.
 */
export async function fetchLatestRelease(signal?: AbortSignal): Promise<LatestRelease> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = (await res.json()) as GithubRelease;

  // Repère l'installeur Windows par son extension puis apparie chaque JAR attendu à son asset.
  const exe = data.assets.find((a) => a.name.toLowerCase().endsWith(".exe"));
  const jarUrls: Record<string, string> = {};
  for (const { os, asset } of JARS) {
    const match = data.assets.find((a) => a.name === asset);
    if (match) jarUrls[os] = match.browser_download_url;
  }

  return {
    version: data.tag_name,
    publishedAt: data.published_at,
    htmlUrl: data.html_url,
    exeUrl: exe?.browser_download_url ?? null,
    jarUrls,
  };
}
