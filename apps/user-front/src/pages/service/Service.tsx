import { useState } from "react";
import { NavLink, Outlet } from 'react-router-dom'
import FilterBar from "../../component/FilterBar";
import type { ListingType } from "../../api-service/api";

export type ServiceOutletContext = {
    selectedType: ListingType | "";
};

const Service = () => {
    const [points, setPoints] = useState(0);
    const [selectedType, setSelectedType] = useState<ListingType | "">("");

    return (
        <div className="flex">

            {/* Left Barre */}
            <div className="w-64 min-h-screen bg-base-100 p-4 flex flex-col gap-6">

                {/* Catégorie */}
                <FilterBar selectedType={selectedType} onChange={setSelectedType} />

                {/* Points */}
                <div className="flex flex-col gap-3 shadow-md rounded-lg p-4 bg-[#f8f7f2]">
                    <h3 className="font-bold text-base-content text-sm uppercase tracking-wide">
                        Points
                    </h3>
                    <input
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={points}
                        onChange={(e) => setPoints(Number(e.target.value))}
                        className="range range-primary range-sm"
                    />
                    <div className="flex justify-between text-xs text-base-content/50 px-1">
                        <span>0</span>
                        <span>10</span>
                    </div>
                    <p className="text-sm text-base-content">
                        Max : <span className="font-bold text-primary">{points} pts</span>
                    </p>
                </div>

            </div>

            {/* Main */}
            <div className="flex-1 p-6">
                <div className="title flex flex-row pb-10">
                    <div className="flex flex-col mr-37.5">
                        <h2 className="text-[30px] font-bold">Services entre voisins</h2>
                        <span className="underline">45 annonces actives</span>
                    </div>
                    <div className="flex flex-col h-25 gap-5">
                        <div className="flex items-center gap-2">
                            <NavLink
                                to="annonces"
                                className={({ isActive }) =>
                                    `btn btn-sm ${isActive
                                        ? "bg-gray-300 border-gray-300 text-base-content hover:bg-gray-300"
                                        : "bg-transparent border-transparent text-base-content hover:bg-gray-100"
                                    }`
                                }>
                                Annonces
                            </NavLink>
                            <NavLink
                                to="mes-annonces"
                                className={({ isActive }) =>
                                    `btn btn-sm ${isActive
                                        ? "bg-gray-300 border-gray-300 text-base-content hover:bg-gray-300"
                                        : "bg-transparent border-transparent text-base-content hover:bg-gray-100"
                                    }`
                                }>
                                Mes annonces
                            </NavLink>
                            <NavLink
                                to="mes-contrats"
                                className={({ isActive }) =>
                                    `btn btn-sm ${isActive
                                        ? "bg-gray-300 border-gray-300 text-base-content hover:bg-gray-300"
                                        : "bg-transparent border-transparent text-base-content hover:bg-gray-100"
                                    }`
                                }>
                                Mes contrats
                            </NavLink>
                        </div>

                        <button className="btn bg-secondary w-45 text-[14px] border-0">+ Créer une annonce</button>
                    </div>
                </div>
                <div className="content">
                    <Outlet context={{ selectedType } satisfies ServiceOutletContext} />
                </div>
            </div>

        </div>
    );
};

export default Service;
