import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ListingQueryDto, ListingResponseDto, TagResponseDto } from "@repo/contracts";
import { getListings } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import ListingCard from "../components/ListingCard";

export default function Search() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState<ListingResponseDto[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const search = params.get("search") ?? "";
  const tag = params.get("tag") ?? "";
  const type = params.get("type") ?? "";
  const activeFilters = (tag ? 1 : 0) + (type ? 1 : 0);

  const query = useMemo<ListingQueryDto>(
    () =>
      ({
        status: "active",
        limit: 40,
        ...(search ? { search } : {}),
        ...(tag ? { tag } : {}),
        ...(type ? { type } : {}),
      }) as ListingQueryDto,
    [search, tag, type],
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
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">{t("search.type")}</h3>
        <div className="flex flex-col gap-1 text-sm">
          {[
            { v: "", label: t("type.all") },
            { v: "offer", label: t("type.offers") },
            { v: "request", label: t("type.requests") },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setFilter("type", o.v)}
              className={`rounded px-2 py-1.5 text-left ${
                type === o.v
                  ? "bg-[color:var(--color-brand-soft)] font-semibold text-[color:var(--color-brand-dark)]"
                  : "hover:bg-neutral-100"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">{t("search.category")}</h3>
        <div className="flex flex-col gap-1 text-sm">
          <button
            onClick={() => setFilter("tag", "")}
            className={`rounded px-2 py-1.5 text-left ${!tag ? "bg-[color:var(--color-brand-soft)] font-semibold text-[color:var(--color-brand-dark)]" : "hover:bg-neutral-100"}`}
          >
            {t("search.allCategories")}
          </button>
          {tags.map((tg) => (
            <button
              key={tg.id}
              onClick={() => setFilter("tag", tg.name)}
              className={`rounded px-2 py-1.5 text-left ${
                tag === tg.name
                  ? "bg-[color:var(--color-brand-soft)] font-semibold text-[color:var(--color-brand-dark)]"
                  : "hover:bg-neutral-100"
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
          <h1 className="truncate text-xl font-bold text-neutral-900">
            {search ? `« ${search} »` : t("search.allListings")}
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm text-neutral-500 sm:inline">{t("search.results", { count: total })}</span>
            {/* Mobile filter trigger */}
            <button
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
              </svg>
              {t("search.filters")}
              {activeFilters > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-1 text-[10px] font-bold text-white">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>
        </div>
        {loading ? (
          <p className="text-neutral-500">{t("common.loading")}</p>
        ) : listings.length === 0 ? (
          <p className="text-neutral-500">{t("search.empty")}</p>
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
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button aria-label="Close" onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-300" />
            <div className="space-y-6">{filterControls}</div>
            <button
              onClick={() => setFiltersOpen(false)}
              className="mt-6 w-full rounded-lg bg-[color:var(--color-brand)] py-3 font-semibold text-white"
            >
              {t("search.results", { count: total })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
