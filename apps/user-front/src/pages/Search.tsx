import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ListingQueryDto, ListingResponseDto, TagResponseDto } from "@repo/contracts";
import { getListings } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import { useFocusTrap } from "../lib/useFocusTrap";
import ListingCard from "../components/ListingCard";

export default function Search() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState<ListingResponseDto[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sheetRef = useFocusTrap<HTMLDivElement>(filtersOpen, () => setFiltersOpen(false));

  const search = params.get("search") ?? "";
  const tag = params.get("tag") ?? "";
  const activeFilters = tag ? 1 : 0;

  const query = useMemo<ListingQueryDto>(
    () =>
      ({
        status: "active",
        limit: 40,
        ...(search ? { search } : {}),
        ...(tag ? { tag } : {}),
      }) as ListingQueryDto,
    [search, tag],
  );

  useEffect(() => {
    getTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    getListings(query)
      .then((page) => {
        setListings(page.data);
        setTotal(page.total);
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [query]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const filterControls = (
    <>
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-base-content/60">{t("search.category")}</h3>
        <div className="flex flex-col gap-1 text-sm">
          <button
            onClick={() => setFilter("tag", "")}
            aria-pressed={!tag}
            className={`rounded px-2 py-1.5 text-left ${!tag ? "bg-primary/10 font-semibold text-primary" : "hover:bg-base-200"}`}
          >
            {t("search.allCategories")}
          </button>
          {tags.map((tg) => (
            <button
              key={tg.id}
              onClick={() => setFilter("tag", tg.name)}
              aria-pressed={tag === tg.name}
              className={`rounded px-2 py-1.5 text-left ${
                tag === tg.name ? "bg-primary/10 font-semibold text-primary" : "hover:bg-base-200"
              }`}
            >
              {tg.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden space-y-6 md:block">{filterControls}</aside>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="truncate text-xl font-bold text-base-content">
            {search ? `« ${search} »` : t("search.allListings")}
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm text-base-content/60 sm:inline">
              {t("search.results", { count: total })}
            </span>
            {/* Mobile filter trigger */}
            <button onClick={() => setFiltersOpen(true)} className="btn btn-soft btn-sm md:hidden">
              <span className="icon-[tabler--adjustments-horizontal] size-4" />
              {t("search.filters")}
              {activeFilters > 0 && <span className="badge badge-primary badge-sm">{activeFilters}</span>}
            </button>
          </div>
        </div>
        {loading ? (
          <p className="text-base-content/60">{t("common.loading")}</p>
        ) : listings.length === 0 ? (
          <p className="text-base-content/60">{t("search.empty")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      {/* Mobile filter sheet */}
      {filtersOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-sheet-title"
        >
          <button
            aria-label={t("common.cancel")}
            onClick={() => setFiltersOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            ref={sheetRef}
            tabIndex={-1}
            className="modal-box absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-base-100 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl outline-none"
          >
            <h2 id="filter-sheet-title" className="sr-only">
              {t("search.filters")}
            </h2>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-base-content/20" />
            <div className="space-y-6">{filterControls}</div>
            <button onClick={() => setFiltersOpen(false)} className="btn btn-primary btn-block mt-6">
              {t("search.results", { count: total })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
