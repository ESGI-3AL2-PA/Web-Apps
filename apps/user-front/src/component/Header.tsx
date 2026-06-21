import logo from '../../public/Logo-connectedNeighbours.png';
import { useEffect, useState } from "react";
import { NavLink } from 'react-router-dom';
import { useAuth } from "@repo/hooks";
import { getUserBalance } from "../api-service/transactions.service";

const Header = () => {
    const [lang, setLang] = useState("FR");
    const { user } = useAuth();
    const [points, setPoints] = useState<number | null>(null);

    // Charge le solde de points du user connecté.
    // Le backend renvoie 403 si l'id ne matche pas → on tombe en silence à null.
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
                        <NavLink to="/"
                            className={({ isActive }) => isActive ? 'active font-medium' : 'font-medium'}>
                            DashBoard
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/service"
                            className={({ isActive }) => isActive ? 'active font-medium' : 'font-medium'}>
                            Service
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/evenement"
                            className={({ isActive }) => isActive ? 'active font-medium' : 'font-medium'}>
                            Evenement
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/messagerie"
                            className={({ isActive }) => isActive ? 'active font-medium' : 'font-medium'}>
                            Messagerie
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/documents"
                            className={({ isActive }) => isActive ? 'active font-medium' : 'font-medium'}>
                            Documents
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/votes"
                            className={({ isActive }) => isActive ? 'active font-medium' : 'font-medium'}>
                            Votes
                        </NavLink>
                    </li>
                </ul>
            </div>

            <div className="navbar-end gap-2">
                <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    className="select select-sm select-bordered w-20">
                    <option value="fr">FR</option>
                    <option value="en">EN</option>
                </select>

                <button className="btn btn-ghost btn-circle">
                    <div className="indicator">
                        🔔
                        <span className="badge badge-xs badge-primary indicator-item"></span>
                    </div>
                </button>

                <div className="avatar placeholder" title="Vos points">
                    <div className="bg-primary text-primary-content rounded-full w-9">
                        <span className="text-xs font-bold">{points !== null ? points : "..."}</span>
                    </div>
                </div>
            </div>

        </div>
    )
}

export default Header
