// The JavaFX admin desktop client ships from a separate repo in the same org.
// Coordinates are fixed (not env-dependent), so they live here rather than in @repo/config.
const REPO = "ESGI-3AL2-PA/Client-Java";

export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

// Fat JARs have fixed asset names, so they resolve at a static "latest" URL even when the
// releases API is unreachable — the component falls back to these.
export const JARS = [
  { os: "windows", icon: "icon-[tabler--brand-windows]", asset: "admin-desktop-windows.jar" },
  { os: "linux", icon: "icon-[tabler--brand-debian]", asset: "admin-desktop-linux.jar" },
  { os: "macos", icon: "icon-[tabler--brand-apple]", asset: "admin-desktop-macos.jar" },
] as const;

export const staticJarUrl = (asset: string): string => `https://github.com/${REPO}/releases/latest/download/${asset}`;

export interface LatestRelease {
  version: string;
  publishedAt: string;
  htmlUrl: string;
  // The Windows installer name is version-stamped, so its URL is only knowable via the API.
  exeUrl: string | null;
  // os -> browser_download_url, resolved from the API (JAR buttons fall back to staticJarUrl).
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

export async function fetchLatestRelease(signal?: AbortSignal): Promise<LatestRelease> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = (await res.json()) as GithubRelease;

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
