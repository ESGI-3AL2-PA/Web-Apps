import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";

const legalLinks = [
  { to: "/privacy", key: "legal.nav.privacy" },
  { to: "/cgu", key: "legal.nav.terms" },
  { to: "/cookies", key: "legal.nav.cookies" },
  { to: "/legal", key: "legal.nav.notice" },
] as const;

export default function MainLayout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[color:var(--color-brand)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t("common.skipToContent")}
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 pb-24 outline-none md:pb-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-28 md:pb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-200 pt-4 text-xs text-neutral-400 dark:border-neutral-800">
          {legalLinks.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-[color:var(--color-brand)]">
              {t(link.key)}
            </Link>
          ))}
        </div>
      </footer>
      <BottomNav />
    </div>
  );
}
