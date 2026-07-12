import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const HomeIcon = () => (
  <svg {...iconProps}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);
const SearchIcon = () => (
  <svg {...iconProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const ChatIcon = () => (
  <svg {...iconProps}>
    <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" />
  </svg>
);
const UserIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

// A single bottom-bar tab: icon + label, brand-colored when active.
function Tab({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition ${
          isActive ? "text-[color:var(--color-brand)]" : "text-neutral-500"
        }`
      }
    >
      {children}
      <span>{label}</span>
    </NavLink>
  );
}

export default function BottomNav() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [sheet, setSheet] = useState(false);

  const go = (to: string) => {
    setSheet(false);
    navigate(to);
  };

  return (
    <>
      {/* Account sheet (slides up from the bottom nav) */}
      {sheet && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button aria-label="Close" onClick={() => setSheet(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-2 mt-1 h-1 w-10 rounded-full bg-neutral-300" />
            <div className="flex items-center gap-3 border-b border-neutral-100 px-3 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-sm font-bold text-white">
                {user?.firstName?.charAt(0) ?? "?"}
              </span>
              <span className="font-semibold text-neutral-900">{user?.firstName ?? t("header.account")}</span>
            </div>
            <button
              onClick={() => go("/mes-annonces")}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-neutral-700 hover:bg-[color:var(--color-brand-soft)]"
            >
              {t("header.myListings")}
            </button>
            <button
              onClick={() => go("/parametres")}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-neutral-700 hover:bg-[color:var(--color-brand-soft)]"
            >
              {t("header.settings")}
            </button>
            <div className="flex items-center justify-between rounded-lg px-3 py-3">
              <span className="text-sm font-medium text-neutral-700">{t("common.language")}</span>
              <div className="flex overflow-hidden rounded-md border border-neutral-300">
                {(["fr", "en"] as const).map((lng) => (
                  <button
                    key={lng}
                    onClick={() => i18n.changeLanguage(lng)}
                    className={`px-3 py-1 text-xs font-semibold uppercase ${
                      i18n.resolvedLanguage === lng
                        ? "bg-[color:var(--color-brand)] text-white"
                        : "bg-white text-neutral-600"
                    }`}
                  >
                    {lng}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                setSheet(false);
                logout();
              }}
              className="mt-1 block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              {t("header.logout")}
            </button>
          </div>
        </div>
      )}

      {/* Fixed bottom bar — mobile only */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-stretch">
          <Tab to="/" label={t("header.home")}>
            <HomeIcon />
          </Tab>
          <Tab to="/recherche" label={t("header.search")}>
            <SearchIcon />
          </Tab>

          {/* Center action — post an ad */}
          <NavLink
            to="/deposer"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium text-neutral-500"
          >
            <span className="-mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-white shadow-lg shadow-[color:var(--color-brand)]/30">
              <svg {...iconProps} width={26} height={26}>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="-mt-2.5">{t("myListings.deposit").replace(/^\+\s*/, "")}</span>
          </NavLink>

          <Tab to="/messages" label={t("header.messages")}>
            <ChatIcon />
          </Tab>
          <button
            onClick={() => setSheet(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium text-neutral-500"
          >
            <UserIcon />
            <span>{t("header.account")}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
