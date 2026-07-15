import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { TagsProvider } from "../app/TagsProvider";

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
          {/* Suspense boundary for the lazy-loaded route chunks. */}
          <Suspense fallback={<p className="text-base-content/60">{t("common.loading")}</p>}>
            <Outlet />
          </Suspense>
        </main>
        <BottomNav />
      </div>
    </TagsProvider>
  );
}
