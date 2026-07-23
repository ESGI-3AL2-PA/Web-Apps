import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { TagsProvider } from "../app/TagsProvider";

/**
 * Layout React principal du user-front.
 *
 * Ossature commune à toutes les pages authentifiées : lien d'évitement
 * (accessibilité), Header, zone `<main>` où s'injectent les routes via `<Outlet>`,
 * et BottomNav en bas d'écran. Enveloppe le tout dans `TagsProvider` pour rendre
 * les tags disponibles, et borne le rendu des chunks de route paresseux par un
 * `<Suspense>`.
 */
export default function MainLayout() {
  const { t } = useTranslation();
  return (
    <TagsProvider>
      <div className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-content"
        >
          {t("common.skipToContent")}
        </a>
        <Header />
        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 pb-24 outline-none md:pb-6">
          {/* Frontière Suspense pour les chunks de route chargés paresseusement. */}
          <Suspense fallback={<p className="text-base-content/60">{t("common.loading")}</p>}>
            <Outlet />
          </Suspense>
        </main>
        <BottomNav />
      </div>
    </TagsProvider>
  );
}
