import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { useTags } from "../app/tags-context";
import { getUserBalance } from "../api-service/transactions.service";
import { formatPrice } from "../lib/format";
import NotificationBell from "./NotificationBell";

// A classifieds-style icon action: icon on top, small label below.
function IconAction({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <Link
      to={to}
      className="flex min-w-[62px] flex-col items-center gap-1 text-base-content/70 transition hover:text-primary"
    >
      <span className={`${icon} size-[22px]`} />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

const MENU_LINKS = [
  { to: "/profil", key: "header.profile" },
  { to: "/mes-annonces", key: "header.myListings" },
  { to: "/mes-contrats", key: "header.contracts" },
  { to: "/incidents", key: "header.incidents" },
  { to: "/parametres", key: "header.settings" },
] as const;

export default function Header() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { tags, label } = useTags();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Live points balance in the avatar area (silent on 403).
  useEffect(() => {
    if (!user?.id) return;
    getUserBalance(user.id)
      .then((r) => setBalance(r.balance))
      .catch(() => setBalance(null));
  }, [user?.id]);

  // Close the account menu on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/recherche?search=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-base-content/10 bg-base-100">
      {/* Row 1 — logo · deposer · search · account actions */}
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <Link to="/" className="flex shrink-0 select-none items-center gap-2 text-xl font-extrabold tracking-tight">
          <img src="/Logo-connectedNeighbours.png" alt={t("header.brand")} className="h-9 w-9" />
          <span className="hidden font-display text-base-content md:inline">{t("header.brand")}</span>
        </Link>

        <Link to="/deposer" className="btn btn-primary hidden shrink-0 sm:inline-flex">
          {t("header.deposit")}
        </Link>

        <form onSubmit={onSearch} className="join min-w-0 flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("header.searchPlaceholder")}
            aria-label={t("header.searchPlaceholder")}
            className="input join-item min-w-0 flex-1"
          />
          <button type="submit" aria-label={t("header.search")} className="btn btn-primary btn-square join-item">
            <span className="icon-[tabler--search] size-5" />
          </button>
        </form>

        <NotificationBell />

        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          <IconAction to="/evenements" label={t("header.events")} icon="icon-[tabler--calendar-event]" />
          <IconAction to="/sondages" label={t("header.polls")} icon="icon-[tabler--chart-bar]" />
          <IconAction to="/messages" label={t("header.messages")} icon="icon-[tabler--message-circle]" />

          {balance !== null && (
            <Link
              to="/profil"
              title={t("header.balance")}
              className="mr-1 hidden shrink-0 items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-content lg:flex"
            >
              {formatPrice(balance)}
            </Link>
          )}

          <div
            ref={menuRef}
            className="relative"
            onKeyDown={(e) => {
              if (e.key === "Escape" && menuOpen) {
                setMenuOpen(false);
                menuButtonRef.current?.focus();
              }
            }}
          >
            <button
              ref={menuButtonRef}
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="account-menu"
              className="flex min-w-[62px] flex-col items-center gap-1 text-base-content/70 hover:text-primary"
            >
              <span className="flex size-[22px] items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-content">
                {user?.firstName?.charAt(0) ?? "?"}
              </span>
              <span className="max-w-[70px] truncate text-xs font-medium">
                {user?.firstName ?? t("header.account")}
              </span>
            </button>
            {menuOpen && (
              <ul
                id="account-menu"
                className="menu absolute right-0 mt-2 w-48 rounded-box border border-base-content/10 bg-base-100 p-1 shadow-lg"
              >
                {MENU_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} onClick={() => setMenuOpen(false)}>
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
                {user && ["admin", "superAdmin"].includes(user.role) && (
                  <li>
                    {/* Separate origin (admin app) — a plain anchor, not a router Link. */}
                    <a href={config.adminUrl} onClick={() => setMenuOpen(false)}>
                      <span className="icon-[tabler--shield] size-4" />
                      {t("header.adminApp")}
                    </a>
                  </li>
                )}
                <li>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                  >
                    {t("header.logout")}
                  </button>
                </li>
              </ul>
            )}
          </div>

          <select
            value={i18n.resolvedLanguage}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            aria-label={t("common.language")}
            className="select select-sm ml-1 w-auto font-semibold"
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
        </nav>
      </div>

      {/* Row 2 — category bar (district tags) */}
      <div className="border-t border-base-content/10">
        <nav className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto px-4 py-2 text-sm font-medium whitespace-nowrap text-base-content/80">
          {/* Events / polls live in the icon nav on desktop; surface them here on mobile. */}
          <Link to="/evenements" className="shrink-0 hover:text-primary md:hidden">
            {t("header.events")}
          </Link>
          <Link to="/sondages" className="shrink-0 hover:text-primary md:hidden">
            {t("header.polls")}
          </Link>
          <span className="h-4 w-px shrink-0 bg-base-content/20 md:hidden" aria-hidden />
          <Link to="/recherche" className="shrink-0 hover:text-primary">
            {t("header.allListings")}
          </Link>
          {tags.map((tag) => (
            <Link
              key={tag.id}
              to={`/recherche?tag=${encodeURIComponent(tag.name)}`}
              className="shrink-0 capitalize hover:text-primary"
            >
              {label(tag)}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
