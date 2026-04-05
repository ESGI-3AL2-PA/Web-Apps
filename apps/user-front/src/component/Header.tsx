import logo from '../../public/Logo-connectedNeighbours.png';
import { useState } from "react";

const Header = () => {
    const [lang, setLang] = useState("FR");

    return (
        <div className="navbar border-b border-base-300 px-50 bg-[#f8f7f2]">

            <div className="navbar-start gap-3">
                <img src={logo} alt="logo" className="size-10" />
                <h1 className="flex flex-col font-bold text-base-content text-2xl leading-tight">
                    <span>Connected</span>
                    <span>NeighBours</span>
                </h1>
            </div>

            <div className="navbar-center">
                <ul className="menu menu-horizontal gap-1">
                    <li><a className="font-medium">Service</a></li>
                    <li><a className="font-medium">Evenement</a></li>
                    <li><a className="font-medium">Messagerie</a></li>
                    <li><a className="font-medium">Documents</a></li>
                    <li><a className="font-medium">Votes</a></li>
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

                <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-9">
                        <span className="text-sm font-bold">P</span>
                    </div>
                </div>
            </div>

        </div>
    )
}

export default Header