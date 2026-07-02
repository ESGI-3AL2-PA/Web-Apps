import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ListingType } from "@repo/contracts";
import CreateListingModal from "../../component/CreateListingModal";
import type { ServiceContext, ServiceFilters } from "./service-context";

const TYPE_OPTIONS: { value: string; labelKey: string; type?: ListingType }[] = [
  { value: "tout", labelKey: "service.type.all", type: undefined },
  { value: "offre", labelKey: "service.type.offer", type: "offer" },
  { value: "demande", labelKey: "service.type.request", type: "request" },
];

// Category names double as listing tags (canonical data), so they are intentionally not translated.
const CATEGORIES = ["Jardinage", "Bricolage", "Garde d'enfants", "Cuisine", "Transport", "Animaux", "Informatique"];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `btn btn-sm ${
    isActive
      ? "bg-base-300 border-base-300 text-base-content hover:bg-base-300"
      : "bg-transparent border-transparent text-base-content hover:bg-base-200"
  }`;

const Service = () => {
  const { t } = useTranslation();
  const [typeValue, setTypeValue] = useState("tout");
  const [categories, setCategories] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Debounce the search box before it drives the server query.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const toggleCategorie = (cat: string) => {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const filters: ServiceFilters = useMemo(
    () => ({
      type: TYPE_OPTIONS.find((o) => o.value === typeValue)?.type,
      search,
      categories,
      maxPrice,
    }),
    [typeValue, search, categories, maxPrice],
  );

  const context: ServiceContext = { filters, refreshKey, setTotal };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Filters */}
      <button className="btn btn-sm w-fit lg:hidden" onClick={() => setFiltersOpen((o) => !o)}>
        {filtersOpen ? t("service.hideFilters") : t("service.showFilters")}
      </button>

      <aside className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-6 lg:flex lg:w-64 lg:shrink-0`}>
        <div className="flex flex-col gap-2 rounded-lg bg-blc p-4 shadow-md">
          <h2 className="text-sm font-bold uppercase tracking-wide text-base-content">{t("service.typeTitle")}</h2>
          <div className="flex flex-col gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="typeAnnonce"
                  className="radio radio-primary radio-sm"
                  checked={typeValue === opt.value}
                  onChange={() => setTypeValue(opt.value)}
                />
                <span className="text-base-content">{t(opt.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-blc p-4 shadow-md">
          <h2 className="text-sm font-bold uppercase tracking-wide text-base-content">{t("service.categoryTitle")}</h2>
          <div className="flex flex-col gap-2">
            {CATEGORIES.map((cat) => (
              <label key={cat} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={categories.includes(cat)}
                  onChange={() => toggleCategorie(cat)}
                />
                <span className="text-base-content">{cat}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-blc p-4 shadow-md">
          <h2 className="text-sm font-bold uppercase tracking-wide text-base-content">{t("service.pointsTitle")}</h2>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="range range-primary range-sm"
            aria-label={t("service.maxPriceLabel")}
          />
          <p className="text-sm text-base-content">
            {t("service.maxLabel")}{" "}
            <span className="font-bold text-primary">
              {maxPrice === 0 ? t("service.maxNone") : t("service.maxPts", { count: maxPrice })}
            </span>
          </p>
        </div>
      </aside>

      {/* Main */}
      <section className="flex-1">
        <div className="flex flex-col gap-4 pb-8 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold">{t("service.title")}</h1>
            <span className="text-base-content/70">
              {total === null ? "—" : t("service.activeCount", { count: total })}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <NavLink to="annonces" className={tabClass}>
                {t("service.tabs.listings")}
              </NavLink>
              <NavLink to="mes-annonces" className={tabClass}>
                {t("service.tabs.myListings")}
              </NavLink>
              <NavLink to="mes-contrats" className={tabClass}>
                {t("service.tabs.myContracts")}
              </NavLink>
            </div>
            <button className="btn btn-secondary w-fit" onClick={() => setCreateOpen(true)}>
              {t("service.create")}
            </button>
          </div>
        </div>

        <input
          type="search"
          placeholder={t("service.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="input input-bordered mb-6 w-full max-w-md"
          aria-label={t("service.searchLabel")}
        />

        <Outlet context={context} />
      </section>

      <CreateListingModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
};

export default Service;
