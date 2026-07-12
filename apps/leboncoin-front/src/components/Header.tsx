import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@repo/hooks";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [q, setQ] = useState("");

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/recherche?search=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex shrink-0 select-none items-center gap-2 text-xl font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-brand)] text-white">
            CN
          </span>
          <span className="hidden sm:inline">
            <span className="text-neutral-900">Connected</span>
            <span className="text-[color:var(--color-brand)]">NeighBours</span>
          </span>
        </Link>

        <form onSubmit={onSearch} className="flex flex-1 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une annonce près de chez vous"
            className="h-11 w-full rounded-l-lg border border-r-0 border-neutral-300 px-4 text-sm outline-none focus:border-[color:var(--color-brand)]"
          />
          <button
            type="submit"
            className="h-11 rounded-r-lg bg-[color:var(--color-brand)] px-5 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
          >
            Rechercher
          </button>
        </form>

        <nav className="flex shrink-0 items-center gap-4 text-sm font-medium text-neutral-700">
          <Link to="/evenements" className="hidden hover:text-[color:var(--color-brand)] lg:inline">
            Événements
          </Link>
          <Link to="/sondages" className="hidden hover:text-[color:var(--color-brand)] lg:inline">
            Sondages
          </Link>
          <Link to="/messages" className="hidden hover:text-[color:var(--color-brand)] sm:inline">
            Messages
          </Link>
          <Link to="/mes-annonces" className="hidden hover:text-[color:var(--color-brand)] sm:inline">
            Mes annonces
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-neutral-400">|</span>
            <span className="text-neutral-600">{user?.firstName}</span>
            <button onClick={() => logout()} className="text-neutral-500 hover:text-[color:var(--color-brand)]">
              Déconnexion
            </button>
          </div>
          <Link
            to="/deposer"
            className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 font-semibold text-white shadow-sm hover:bg-[color:var(--color-brand-dark)]"
          >
            + Déposer une annonce
          </Link>
        </nav>
      </div>
    </header>
  );
}
