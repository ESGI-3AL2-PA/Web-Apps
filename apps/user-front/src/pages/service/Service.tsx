import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import FilterBar from "../../component/FilterBar";
import { getActiveListingsCount } from "../../api-service/api";

// Outlet context : on partage le `tag` sélectionné (nom du tag, "" = aucun filtre)
export type ServiceOutletContext = {
  selectedTag: string;
};

const Service = () => {
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [activeCount, setActiveCount] = useState<number | null>(null);

  useEffect(() => {
    getActiveListingsCount()
      .then(setActiveCount)
      .catch(() => setActiveCount(null));
  }, []);

  return (
    <div className="flex">
      {/* Left Barre */}
      <div className="w-64 min-h-screen bg-base-100 p-4 flex flex-col gap-6">
        {/* Catégorie */}
        <FilterBar selectedTag={selectedTag} onChange={setSelectedTag} />
      </div>

      {/* Main */}
      <div className="flex-1 p-6">
        <div className="title flex flex-row pb-10">
          <div className="flex flex-col mr-37.5">
            <h2 className="text-[30px] font-bold">Services entre voisins</h2>
            <span className="underline">
              {activeCount !== null ? `${activeCount} annonces actives` : "Chargement..."}
            </span>
          </div>
          <div className="flex flex-col h-25 gap-5">
            <div className="flex items-center gap-2">
              <NavLink
                to="annonces"
                className={({ isActive }) =>
                  `btn btn-sm ${
                    isActive
                      ? "bg-gray-300 border-gray-300 text-base-content hover:bg-gray-300"
                      : "bg-transparent border-transparent text-base-content hover:bg-gray-100"
                  }`
                }
              >
                Annonces
              </NavLink>
              <NavLink
                to="mes-annonces"
                className={({ isActive }) =>
                  `btn btn-sm ${
                    isActive
                      ? "bg-gray-300 border-gray-300 text-base-content hover:bg-gray-300"
                      : "bg-transparent border-transparent text-base-content hover:bg-gray-100"
                  }`
                }
              >
                Mes annonces
              </NavLink>
              <NavLink
                to="mes-contrats"
                className={({ isActive }) =>
                  `btn btn-sm ${
                    isActive
                      ? "bg-gray-300 border-gray-300 text-base-content hover:bg-gray-300"
                      : "bg-transparent border-transparent text-base-content hover:bg-gray-100"
                  }`
                }
              >
                Mes contrats
              </NavLink>
            </div>
            <NavLink to="/creationService">
              <button className="btn bg-secondary w-45 text-[14px] border-0">+ Créer une annonce</button>
            </NavLink>
          </div>
        </div>
        <div className="content">
          <Outlet context={{ selectedTag } satisfies ServiceOutletContext} />
        </div>
      </div>
    </div>
  );
};

export default Service;
