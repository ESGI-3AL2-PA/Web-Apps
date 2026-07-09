import logo from "../../public/Logo-connectedNeighbours.png";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@repo/hooks";
import { getUserBalance } from "../api-service/transactions.service";

const Header = () => {
  const [lang, setLang] = useState("FR");
  const { user, logout } = useAuth();
  const [points, setPoints] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Charge le solde de points du user connecté. 403 silencieux → null.
  useEffect(() => {
    if (!user?.id) {
      setPoints(null);
      return;
    }
    let cancelled = false;
    getUserBalance(user.id)
      .then((res) => {
        if (!cancelled) setPoints(res.balance);
      })
      .catch(() => {
        if (!cancelled) setPoints(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Ferme le menu si on clique en dehors.
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    // ProtectedRoute détecte isAuthenticated=false et redirige vers auth-service /login.
    window.location.href = "/";
  };

  return (
    <div className="navbar border-b border-black/10 px-50 bg-blc">
      <div className="navbar-start gap-3">
        <img src={logo} alt="logo" className="size-10" />
        <h1 className="flex flex-col font-bold text-base-content text-2xl leading-tight">
          <span>Connected</span>
          <span>NeighBours</span>
        </h1>
      </div>

      <div className="navbar-center">
        <ul className="menu menu-horizontal gap-1 text-[18px]">
          <li>
            <NavLink to="/" className={({ isActive }) => (isActive ? "active font-medium" : "font-medium")}>
              DashBoard
            </NavLink>
          </li>
          <li>
            <NavLink to="/service" className={({ isActive }) => (isActive ? "active font-medium" : "font-medium")}>
              Service
            </NavLink>
          </li>
          <li>
            <NavLink to="/evenement" className={({ isActive }) => (isActive ? "active font-medium" : "font-medium")}>
              Evenement
            </NavLink>
          </li>
          <li>
            <NavLink to="/messagerie" className={({ isActive }) => (isActive ? "active font-medium" : "font-medium")}>
              Messagerie
            </NavLink>
          </li>
          <li>
            <NavLink to="/votes" className={({ isActive }) => (isActive ? "active font-medium" : "font-medium")}>
              Votes
            </NavLink>
          </li>
        </ul>
      </div>

      <div className="navbar-end gap-2">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="select select-sm select-bordered w-20"
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>

        <button className="btn btn-ghost btn-circle">
          <div className="indicator">
            🔔
            <span className="badge badge-xs badge-primary indicator-item"></span>
          </div>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="avatar placeholder cursor-pointer"
            title="Mon profil"
            aria-label="Menu du profil"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="bg-primary text-primary-content rounded-full w-9 flex items-center justify-center">
              <span className="text-xs font-bold">{points !== null ? points : "..."}</span>
            </div>
          </button>
          {menuOpen && (
            <ul className="absolute right-0 mt-3 z-50 p-2 shadow bg-base-100 rounded-box w-52 border border-black/10 menu menu-sm">
              {user && (
                <li className="menu-title">
                  <span className="text-xs">
                    {user.firstName} {user.lastName}
                  </span>
                </li>
              )}
              <li>
                <Link to="/profile" onClick={() => setMenuOpen(false)}>
                  👤 Mon profil
                </Link>
              </li>
              <li>
                <button onClick={handleLogout} className="text-red-600">
                  🚪 Déconnexion
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
