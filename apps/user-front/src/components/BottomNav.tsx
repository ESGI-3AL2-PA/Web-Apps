import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { useFocusTrap } from "../lib/useFocusTrap";

// Un onglet de la barre inférieure : icône + libellé, coloré aux couleurs de la marque quand actif.
function Tab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition ${
          isActive ? "text-primary" : "text-base-content/60"
        }`
      }
    >
      <span className={`${icon} size-6`} />
      <span>{label}</span>
    </NavLink>
  );
}

// Liens listés dans la feuille « compte » qui glisse depuis le bas.
const SHEET_LINKS = [
  { to: "/profil", key: "header.profile" },
  { to: "/mes-annonces", key: "header.myListings" },
  { to: "/mes-contrats", key: "header.contracts" },
  { to: "/incidents", key: "header.incidents" },
  { to: "/parametres", key: "header.settings" },
] as const;

/**
 * Barre de navigation inférieure, affichée uniquement sur mobile (`md:hidden`).
 * Onglets fixes (accueil, recherche, dépôt d'annonce, messages) plus un bouton « compte »
 * qui ouvre une feuille glissante contenant les liens de profil, le sélecteur de langue
 * et la déconnexion. Le focus y est piégé via useFocusTrap.
 */
export default function BottomNav() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [sheet, setSheet] = useState(false);
  const sheetRef = useFocusTrap<HTMLDivElement>(sheet, () => setSheet(false));

  // Ferme la feuille puis navigue vers la destination choisie.
  const go = (to: string) => {
    setSheet(false);
    navigate(to);
  };

  return (
    <>
      {/* Feuille « compte » (glisse depuis la barre inférieure) */}
      {sheet && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-sheet-title"
        >
          <button
            aria-label={t("common.cancel")}
            onClick={() => setSheet(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            ref={sheetRef}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-base-100 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl outline-none"
          >
            <div className="mx-auto mb-2 mt-1 h-1 w-10 rounded-full bg-base-content/20" />
            <div className="flex items-center gap-3 border-b border-base-content/10 px-3 py-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-content">
                {user?.firstName?.charAt(0) ?? "?"}
              </span>
              <span id="account-sheet-title" className="font-semibold text-base-content">
                {user?.firstName ?? t("header.account")}
              </span>
            </div>
            {SHEET_LINKS.map((link) => (
              <button
                key={link.to}
                onClick={() => go(link.to)}
                className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-base-content hover:bg-base-200"
              >
                {t(link.key)}
              </button>
            ))}
            {/* Sélecteur de langue FR / EN (bouton actif surligné via aria-pressed) */}
            <div className="flex items-center justify-between rounded-lg px-3 py-3">
              <span className="text-sm font-medium text-base-content">{t("common.language")}</span>
              <div className="join">
                {(["fr", "en"] as const).map((lng) => (
                  <button
                    key={lng}
                    onClick={() => i18n.changeLanguage(lng)}
                    aria-pressed={i18n.resolvedLanguage === lng}
                    className={`btn btn-sm join-item uppercase ${
                      i18n.resolvedLanguage === lng ? "btn-primary" : "btn-soft"
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
              className="mt-1 block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-error hover:bg-error/10"
            >
              {t("header.logout")}
            </button>
          </div>
        </div>
      )}

      {/* Barre inférieure fixe — mobile uniquement */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-base-content/10 bg-base-100 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-stretch">
          <Tab to="/" label={t("header.home")} icon="icon-[tabler--home]" />
          <Tab to="/recherche" label={t("header.search")} icon="icon-[tabler--search]" />

          {/* Action centrale — déposer une annonce (bouton flottant mis en avant) */}
          <NavLink
            to="/deposer"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium text-base-content/60"
          >
            <span className="-mt-4 flex size-11 items-center justify-center rounded-full bg-primary text-primary-content shadow-lg shadow-primary/30">
              <span className="icon-[tabler--plus] size-6" />
            </span>
            {/* Retire un éventuel « + » de tête du libellé traduit (l'icône « + » le rend déjà) */}
            <span className="-mt-2.5">{t("myListings.deposit").replace(/^\+\s*/, "")}</span>
          </NavLink>

          <Tab to="/messages" label={t("header.messages")} icon="icon-[tabler--message-circle]" />
          <button
            onClick={() => setSheet(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium text-base-content/60"
          >
            <span className="icon-[tabler--user] size-6" />
            <span>{t("header.account")}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
