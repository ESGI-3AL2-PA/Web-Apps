import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Public chrome for the legal pages. Unlike MainLayout, these routes are NOT
// behind ProtectedRoute — the notices must be reachable without an account.

const logo = "/Logo-connectedNeighbours.png";

const legalLinks = [
  { to: "/privacy", key: "legal.nav.privacy" },
  { to: "/cgu", key: "legal.nav.terms" },
  { to: "/cookies", key: "legal.nav.cookies" },
  { to: "/legal", key: "legal.nav.notice" },
] as const;

export default function LegalLayout() {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="size-8" />
            <span className="font-bold text-neutral-900 dark:text-neutral-50">Connected NeighBours</span>
          </Link>
          <select
            value={i18n.language.toLowerCase().startsWith("en") ? "en" : "fr"}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            aria-label={t("common.language")}
            className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-5 text-sm">
          {legalLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive
                  ? "font-semibold text-[color:var(--color-brand)]"
                  : "text-neutral-500 hover:text-[color:var(--color-brand)] dark:text-neutral-400"
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
          <Link to="/" className="ml-auto text-neutral-400 hover:text-[color:var(--color-brand)]">
            {t("legal.backToApp")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
