import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { applyTheme, getInitialTheme, type Theme } from "../lib/theme";
import NotificationsBell from "./NotificationsBell";

const navItems = [
  { to: "/", labelKey: "nav.dashboard", end: true },
  { to: "/service", labelKey: "nav.services", end: false },
  { to: "/evenement", labelKey: "nav.events", end: false },
  { to: "/votes", labelKey: "nav.votes", end: false },
];

const panelClass = "absolute z-20 mt-2 min-w-52 rounded-box border border-base-content/10 bg-base-100 p-2 shadow-lg";
const summaryClass = "list-none cursor-pointer [&::-webkit-details-marker]:hidden";

const Header = () => {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const { user, logout } = useAuth();

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const initials = user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?" : "?";
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const isAdmin = user?.role === "admin" || user?.role === "superAdmin";
  const lang = i18n.language?.startsWith("en") ? "en" : "fr";

  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active font-medium" : "font-medium");

  return (
    <header className="navbar border-b border-base-content/10 bg-blc px-4 sm:px-6 lg:px-8">
      {/* Start: mobile menu + logo */}
      <div className="navbar-start gap-2">
        <details className="dropdown relative md:hidden">
          <summary className={`btn btn-ghost btn-circle ${summaryClass}`} aria-label={t("header.openMenu")}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </summary>
          <ul className={`menu ${panelClass} left-0 gap-1`}>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={linkClass}>
                  {t(item.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </details>

        <img src="/Logo-connectedNeighbours.png" alt="Connected NeighBours" className="size-10" />
        <span className="hidden flex-col text-2xl font-bold leading-tight text-base-content sm:flex">
          <span>Connected</span>
          <span>NeighBours</span>
        </span>
      </div>

      {/* Center: desktop nav */}
      <nav className="navbar-center hidden md:flex">
        <ul className="menu menu-horizontal gap-1 text-[18px]">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={linkClass}>
                {t(item.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* End: language, notifications, account */}
      <div className="navbar-end gap-2">
        <select
          value={lang}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          aria-label={t("header.language")}
          className="select select-sm select-bordered w-20"
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>

        <button
          className="btn btn-ghost btn-circle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("header.toLight") : t("header.toDark")}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
        </button>

        <NotificationsBell />

        <details className="dropdown relative">
          <summary
            className={`avatar avatar-placeholder btn btn-ghost btn-circle ${summaryClass}`}
            aria-label={t("header.account")}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-content">
              {initials}
            </span>
          </summary>
          <ul className={`menu ${panelClass} right-0 gap-1`}>
            {fullName && (
              <li className="menu-title truncate px-2 py-1 text-sm opacity-70">
                <span>{fullName}</span>
              </li>
            )}
            {isAdmin && (
              <li>
                <a href={config.adminUrl}>{t("header.adminSpace")}</a>
              </li>
            )}
            <li>
              <button type="button" onClick={() => logout()}>
                {t("header.logout")}
              </button>
            </li>
          </ul>
        </details>
      </div>
    </header>
  );
};

export default Header;
