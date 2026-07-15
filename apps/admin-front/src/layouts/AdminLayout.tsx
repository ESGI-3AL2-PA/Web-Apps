import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useMatches } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { useDistrictScope } from "../app/DistrictScopeProvider";
import { useTheme } from "../hooks/useTheme";

interface NavItem {
  to: string;
  // i18n key under `nav.*`
  label: string;
  icon: string;
}

// `section` and `label` hold i18n keys, resolved at render (this array is module-scoped and can't
// call the translation hook).
const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "nav.overview",
    items: [{ to: "/", label: "nav.dashboard", icon: "icon-[tabler--layout-dashboard]" }],
  },
  {
    section: "nav.community",
    items: [
      { to: "/users", label: "nav.users", icon: "icon-[tabler--users]" },
      { to: "/districts", label: "nav.districts", icon: "icon-[tabler--map-2]" },
      { to: "/tags", label: "nav.tags", icon: "icon-[tabler--tags]" },
      { to: "/incidents", label: "nav.incidents", icon: "icon-[tabler--alert-triangle]" },
    ],
  },
  {
    section: "nav.moderation",
    items: [
      { to: "/listings", label: "nav.listings", icon: "icon-[tabler--clipboard-list]" },
      { to: "/events", label: "nav.events", icon: "icon-[tabler--calendar-event]" },
      { to: "/votes", label: "nav.votes", icon: "icon-[tabler--checkbox]" },
    ],
  },
];

export default function AdminLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const scope = useDistrictScope();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const matches = useMatches();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isSuperAdmin = user?.role === "superAdmin";

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Keep the document title in sync with the active route's handle (an i18n key) and language.
  useEffect(() => {
    const match = [...matches].reverse().find((m) => (m.handle as { title?: string })?.title);
    const titleKey = (match?.handle as { title?: string })?.title;
    document.title = titleKey ? t("common.titleSuffix", { title: t(titleKey) }) : t("common.appTitle");
  }, [matches, t, i18n.language]);

  const sidebar = (
    <>
      <div className="h-16 flex items-center gap-2 px-5 border-b border-base-content/10">
        <a
          href={config.appUrl}
          className="btn btn-sm btn-circle btn-text"
          aria-label={t("nav.backToApp")}
          title={t("nav.backToApp")}
        >
          <span className="icon-[tabler--arrow-left] size-5" />
        </a>
        <span className="icon-[tabler--building-community] size-6 text-primary" />
        <span className="font-semibold">{t("nav.adminConsole")}</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="px-3 mb-1 text-xs font-medium uppercase tracking-wide text-base-content/50">
              {t(group.section)}
            </p>
            <ul className="menu p-0 gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-btn px-3 py-2 text-sm ${
                        isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-base-200"
                      }`
                    }
                  >
                    <span className={`${item.icon} size-5`} />
                    {t(item.label)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen bg-base-200/40">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-content"
      >
        {t("nav.skipToContent")}
      </a>
      {/* Static sidebar (desktop) */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-base-100 border-e border-base-content/10 flex-col">
        {sidebar}
      </aside>

      {/* Off-canvas sidebar (mobile) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 bg-base-100 border-e border-base-content/10 flex flex-col shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-base-100 border-b border-base-content/10 flex items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="btn btn-sm btn-text btn-circle lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label={t("nav.openMenu")}
            >
              <span className="icon-[tabler--menu-2] size-5" />
            </button>

            {isSuperAdmin ? (
              scope.loading ? (
                <div className="h-8 w-40 rounded bg-base-200 animate-pulse" />
              ) : (
                <>
                  <span className="hidden sm:inline text-xs uppercase tracking-wide text-base-content/50">
                    {t("nav.auditing")}
                  </span>
                  <select
                    className="select select-sm max-w-[12rem]"
                    value={scope.districtId ?? ""}
                    onChange={(e) => scope.setDistrictId(e.target.value)}
                    aria-label={t("nav.districtToAudit")}
                  >
                    {scope.districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </>
              )
            ) : scope.loading ? (
              <div className="h-6 w-32 rounded bg-base-200 animate-pulse" />
            ) : scope.districtName ? (
              <span className="badge badge-soft badge-primary gap-1 truncate">
                <span className="icon-[tabler--map-pin] size-4" />
                {scope.districtName}
              </span>
            ) : (
              <span className="text-xs text-warning">{t("nav.noDistrict")}</span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <select
              className="select select-sm max-w-[4.5rem]"
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              aria-label={t("nav.language")}
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
            <button
              className="btn btn-sm btn-text btn-circle"
              onClick={toggle}
              aria-label={theme === "dark" ? t("nav.themeToLight") : t("nav.themeToDark")}
            >
              <span className={`${theme === "dark" ? "icon-[tabler--sun]" : "icon-[tabler--moon]"} size-5`} />
            </button>
            <div className="hidden sm:block text-end leading-tight">
              <p className="text-sm font-medium">{user ? `${user.firstName} ${user.lastName}` : "—"}</p>
              <p className="text-xs text-base-content/60">{user ? t(`role.${user.role}`) : ""}</p>
            </div>
            <button className="btn btn-sm btn-soft btn-error gap-2" onClick={() => logout()}>
              <span className="icon-[tabler--logout] size-4" />
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto p-4 sm:p-6 outline-none">
          {/* Suspense boundary for the lazy-loaded route chunks. */}
          <Suspense fallback={<div className="h-32 w-full rounded bg-base-200 animate-pulse" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
