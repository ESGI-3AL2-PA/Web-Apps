import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@repo/hooks";
import type { TagResponseDto } from "@repo/contracts";
import { getTags } from "../api-service/tags.service";

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const CalendarIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="4.5" width="18" height="17" rx="2" />
    <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
  </svg>
);
const PollIcon = () => (
  <svg {...iconProps}>
    <path d="M5 21V11M12 21V4M19 21v-7" />
  </svg>
);
const ChatIcon = () => (
  <svg {...iconProps}>
    <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" />
  </svg>
);
const SearchIcon = () => (
  <svg {...iconProps} width={18} height={18}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

// A leboncoin-style icon action: icon on top, small label below.
function IconAction({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-w-[62px] flex-col items-center gap-1 text-neutral-600 transition hover:text-[color:var(--color-brand)]"
    >
      {children}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [q, setQ] = useState("");
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

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
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      {/* Row 1 — logo · deposer · search · account actions */}
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <Link to="/" className="flex shrink-0 select-none items-center gap-2 text-xl font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-brand)] text-white">
            CN
          </span>
          <span className="hidden md:inline">
            <span className="text-neutral-900">Connected</span>
            <span className="text-[color:var(--color-brand)]">NeighBours</span>
          </span>
        </Link>

        <Link
          to="/deposer"
          className="hidden shrink-0 rounded-lg bg-[color:var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--color-brand-dark)] sm:inline-block"
        >
          + Déposer une annonce
        </Link>

        <form onSubmit={onSearch} className="min-w-0 flex-1">
          <div className="flex items-center rounded-lg bg-neutral-100 p-1 focus-within:ring-2 focus-within:ring-[color:var(--color-brand)]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher sur Connected NeighBours"
              className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-neutral-500"
            />
            <button
              type="submit"
              aria-label="Rechercher"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-brand)] text-white hover:bg-[color:var(--color-brand-dark)]"
            >
              <SearchIcon />
            </button>
          </div>
        </form>

        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          <IconAction to="/evenements" label="Événements">
            <CalendarIcon />
          </IconAction>
          <IconAction to="/sondages" label="Sondages">
            <PollIcon />
          </IconAction>
          <IconAction to="/messages" label="Messages">
            <ChatIcon />
          </IconAction>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex min-w-[62px] flex-col items-center gap-1 text-neutral-600 hover:text-[color:var(--color-brand)]"
            >
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[color:var(--color-brand)] text-xs font-bold text-white">
                {user?.firstName?.charAt(0) ?? "?"}
              </span>
              <span className="max-w-[70px] truncate text-xs font-medium">{user?.firstName ?? "Compte"}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                <Link
                  to="/mes-annonces"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-neutral-700 hover:bg-[color:var(--color-brand-soft)]"
                >
                  Mes annonces
                </Link>
                <Link
                  to="/messages"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-neutral-700 hover:bg-[color:var(--color-brand-soft)]"
                >
                  Messages
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-[color:var(--color-brand-soft)]"
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Row 2 — category bar (district tags) */}
      <div className="border-t border-neutral-100">
        <nav className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto px-4 py-2 text-sm font-medium whitespace-nowrap text-neutral-700">
          <Link to="/recherche" className="shrink-0 hover:text-[color:var(--color-brand)]">
            Toutes les annonces
          </Link>
          {tags.map((tag) => (
            <Link
              key={tag.id}
              to={`/recherche?tag=${encodeURIComponent(tag.name)}`}
              className="shrink-0 capitalize hover:text-[color:var(--color-brand)]"
            >
              {tag.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
