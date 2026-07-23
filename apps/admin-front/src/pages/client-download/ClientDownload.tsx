// Page de téléchargement du client desktop (JavaFX) : récupère la dernière release GitHub et
// propose les liens de téléchargement (exécutable Windows + JARs par OS), avec repli sur des URLs
// statiques si la release ne fournit pas d'asset.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../lib/format";
import { JARS, RELEASES_PAGE, fetchLatestRelease, staticJarUrl } from "./latest-release";
import type { LatestRelease } from "./latest-release";

export default function ClientDownload() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [release, setRelease] = useState<LatestRelease | null>(null);

  // Au montage : récupère la dernière release. L'AbortController annule la requête au démontage
  // et évite de basculer en erreur si l'abandon est volontaire.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchLatestRelease(ctrl.signal)
      .then((r) => {
        setRelease(r);
        setStatus("ready");
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setStatus("error");
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("client.title")}</h1>
        <p className="text-sm text-base-content/60">{t("client.subtitle")}</p>
      </div>

      <div className="bg-base-100 rounded-box max-w-2xl space-y-5 border border-base-content/10 p-5">
        {status === "ready" && release && (
          <span className="badge badge-soft badge-primary gap-1">
            <span className="icon-[tabler--tag] size-4" />
            {t("client.latest", { version: release.version, date: formatDate(release.publishedAt) })}
          </span>
        )}
        {status === "error" && (
          <p className="flex items-center gap-2 text-sm text-warning">
            <span className="icon-[tabler--alert-triangle] size-4 shrink-0" />
            {t("client.fetchError")}
          </p>
        )}

        {status === "ready" && release?.exeUrl && (
          <a href={release.exeUrl} download target="_blank" rel="noopener noreferrer" className="btn btn-primary gap-2">
            <span className="icon-[tabler--brand-windows] size-5" />
            {t("client.downloadExe")}
          </a>
        )}

        {/* Un bouton de JAR par OS : URL fournie par la release, sinon repli sur l'asset statique. */}
        <div className="flex flex-wrap gap-2">
          {JARS.map(({ os, icon, asset }) => (
            <a
              key={os}
              href={release?.jarUrls[os] ?? staticJarUrl(asset)}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-soft gap-2"
            >
              <span className={`${icon} size-5`} />
              {t("client.downloadJar", { os: t(`client.os.${os}`) })}
            </a>
          ))}
        </div>

        <p className="text-xs text-base-content/50">{t("client.requirement")}</p>

        <a href={RELEASES_PAGE} target="_blank" rel="noopener noreferrer" className="btn btn-text btn-sm gap-1 px-0">
          <span className="icon-[tabler--brand-github] size-4" />
          {t("client.viewReleases")}
          <span className="icon-[tabler--external-link] size-4" />
        </a>
      </div>
    </div>
  );
}
