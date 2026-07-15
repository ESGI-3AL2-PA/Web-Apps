import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { SessionResponseDto } from "@repo/contracts";
import { getSessions, revokeOtherSessions, revokeSession } from "../api-service/sessions.service";
import { deleteAccount, exportMyData, requestPasswordReset } from "../api-service/account.service";
import { formatRelative } from "../lib/format";
import { getTheme, setTheme, type Theme } from "../lib/theme";
import { useDialog } from "../components/dialog-context";

// Best-effort, presentation-only parse of the stored user-agent string.
function describeDevice(ua: string | null, fallback: string): string {
  if (!ua) return fallback;
  const browser = /Firefox\//.test(ua)
    ? "Firefox"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : fallback;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iOS/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card border border-base-content/10 bg-base-100 p-5">
      <h2 className="text-lg font-bold text-base-content">{title}</h2>
      {description && <p className="mt-1 text-sm text-base-content/60">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const { user, logout, getAccessToken, refresh } = useAuth();
  const { confirm, alert } = useDialog();

  const [sessions, setSessions] = useState<SessionResponseDto[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pwSent, setPwSent] = useState(false);
  const [theme, setThemeState] = useState<Theme>(getTheme());

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    setThemeState(next);
  };

  const token = useCallback(
    async (): Promise<string | null> => getAccessToken() ?? (await refresh()),
    [getAccessToken, refresh],
  );

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const tok = await token();
      if (!tok) return;
      setSessions(await getSessions(tok));
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [token]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onResetPassword = async () => {
    if (!user) return;
    const ok = await confirm({
      title: t("settings.password.title"),
      message: t("settings.password.confirm"),
      confirmLabel: t("settings.password.action"),
    });
    if (!ok) return;
    setBusy("password");
    try {
      await requestPasswordReset(user.email);
      setPwSent(true);
    } finally {
      setBusy(null);
    }
  };

  const onRevoke = async (session: SessionResponseDto) => {
    setBusy(`revoke:${session.id}`);
    try {
      const tok = await token();
      if (tok) await revokeSession(tok, session.id);
      // Revoking the current session ends this login — log out and bounce.
      if (session.current) {
        await logout();
        window.location.href = "/";
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch {
      await alert({ message: t("settings.sessions.error") });
      await loadSessions();
    } finally {
      setBusy(null);
    }
  };

  const onRevokeOthers = async () => {
    setBusy("revoke-others");
    try {
      const tok = await token();
      if (tok) await revokeOtherSessions(tok);
      setSessions((prev) => prev.filter((s) => s.current));
    } catch {
      await alert({ message: t("settings.sessions.error") });
      await loadSessions();
    } finally {
      setBusy(null);
    }
  };

  const onExport = async () => {
    if (!user) return;
    setBusy("export");
    try {
      const data = await exportMyData(user.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `mes-donnees-${user.id}.json`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      await alert({ message: t("settings.data.error") });
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    if (!user) return;
    const ok = await confirm({
      title: t("settings.danger.title"),
      message: t("settings.danger.confirm"),
      confirmLabel: t("settings.danger.action"),
      tone: "danger",
    });
    if (!ok) return;
    setBusy("delete");
    try {
      await deleteAccount(user.id);
      await logout();
      window.location.href = "/";
    } catch {
      setBusy(null);
    }
  };

  const hasOthers = sessions.some((s) => !s.current);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold text-base-content">{t("settings.title")}</h1>

      {/* Appearance */}
      <Card title={t("settings.appearance.title")} description={t("settings.appearance.desc")}>
        <div className="inline-flex overflow-hidden rounded-lg border border-base-content/20">
          {(["light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => chooseTheme(mode)}
              aria-pressed={theme === mode}
              className={`px-4 py-2 text-sm font-semibold ${
                theme === mode
                  ? "bg-primary text-primary-content"
                  : "bg-base-100 text-base-content/80 hover:bg-base-200"
              }`}
            >
              {t(`settings.appearance.${mode}`)}
            </button>
          ))}
        </div>
      </Card>

      {/* Password */}
      <Card title={t("settings.password.title")} description={t("settings.password.desc")}>
        {pwSent ? (
          <p className="text-sm font-medium text-success">{t("settings.password.sent")}</p>
        ) : (
          <button onClick={onResetPassword} disabled={busy === "password"} className="btn btn-primary">
            {t("settings.password.action")}
          </button>
        )}
      </Card>

      {/* Active sessions */}
      <Card title={t("settings.sessions.title")} description={t("settings.sessions.desc")}>
        {loadingSessions ? (
          <p className="text-sm text-base-content/60">{t("common.loading")}</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-base-content/60">{t("settings.sessions.empty")}</p>
        ) : (
          <>
            <ul className="divide-y divide-base-content/10">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-base-content">
                      <span className="truncate">
                        {describeDevice(s.userAgent, t("settings.sessions.unknownDevice"))}
                      </span>
                      {s.current && (
                        <span className="badge badge-primary badge-soft badge-sm shrink-0">
                          {t("settings.sessions.current")}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-base-content/60">
                      {s.ip ?? "—"} ·{" "}
                      {t("settings.sessions.lastUsed", { when: formatRelative(s.lastUsedAt ?? s.createdAt) })}
                    </p>
                  </div>
                  <button
                    onClick={() => onRevoke(s)}
                    disabled={busy === `revoke:${s.id}`}
                    className="btn btn-soft btn-sm shrink-0"
                  >
                    {s.current ? t("settings.sessions.logout") : t("settings.sessions.revoke")}
                  </button>
                </li>
              ))}
            </ul>
            {hasOthers && (
              <button onClick={onRevokeOthers} disabled={busy === "revoke-others"} className="btn btn-soft btn-sm mt-3">
                {t("settings.sessions.revokeOthers")}
              </button>
            )}
          </>
        )}
      </Card>

      {/* GDPR data export */}
      <Card title={t("settings.data.title")} description={t("settings.data.desc")}>
        <button onClick={onExport} disabled={busy === "export"} className="btn btn-soft">
          {t("settings.data.action")}
        </button>
      </Card>

      {/* Danger zone */}
      <section className="rounded-box border border-error/30 bg-error/10 p-5">
        <h2 className="text-lg font-bold text-error">{t("settings.danger.title")}</h2>
        <p className="mt-1 text-sm text-error">{t("settings.danger.desc")}</p>
        <button onClick={onDelete} disabled={busy === "delete"} className="btn btn-error mt-4">
          {t("settings.danger.action")}
        </button>
      </section>
    </div>
  );
}
