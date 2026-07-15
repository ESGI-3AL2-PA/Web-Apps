import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ListingQueryInput, ListingResponseDto, ListingType, TagResponseDto } from "@repo/contracts";
import { getListings } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import { useFocusTrap } from "../lib/useFocusTrap";
import ListingCard from "../components/ListingCard";

const PAGE_SIZE = 24;
const LISTING_TYPES: ListingType[] = ["offer", "request"];
const SORTS = ["recent", "price-asc", "price-desc"] as const;
type Sort = (typeof SORTS)[number];

export default function Search() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState<ListingResponseDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sheetRef = useFocusTrap<HTMLDivElement>(filtersOpen, () => setFiltersOpen(false));

  const search = params.get("search") ?? "";
  const tag = params.get("tag") ?? "";
  const rawType = params.get("type") ?? "";
  const type = (LISTING_TYPES as string[]).includes(rawType) ? (rawType as ListingType) : "";
  const rawSort = params.get("sort") ?? "";
  const sort: Sort = (SORTS as readonly string[]).includes(rawSort) ? (rawSort as Sort) : "recent";
  const activeFilters = (tag ? 1 : 0) + (type ? 1 : 0);

  // Server-supported filters only (search / tag / type / status). Sort and price
  // ordering are NOT backend query params, so they are applied client-side below.
  const baseFilter = useMemo<ListingQueryInput>(
    () => ({
      status: "active",
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(tag ? { tag } : {}),
      ...(type ? { type } : {}),
    }),
    [search, tag, type],
  );

  useEffect(() => {
    getTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  // Initial load + refetch whenever a server-side filter (or retry) changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setLoadMoreError(false);
    getListings({ ...baseFilter, page: 1 })
      .then((res) => {
        if (cancelled) return;
        setListings(res.data);
        setTotal(res.total);
        setPage(1);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseFilter, reloadKey]);

  const loadMore = () => {
    const next = page + 1;
    setLoadingMore(true);
    setLoadMoreError(false);
    getListings({ ...baseFilter, page: next })
      .then((res) => {
        setListings((prev) => [...prev, ...res.data]);
        setTotal(res.total);
        setPage(next);
      })
      .catch(() => setLoadMoreError(true))
      .finally(() => setLoadingMore(false));
  };

  // Client-side ordering over the currently loaded set. The backend returns pages
  // in natural (unordered) Mongo order and exposes no sort param, so this sorts
  // what has been fetched so far — "Load more" pulls the rest into the set.
  const sortedListings = useMemo(() => {
    const arr = [...listings];
    if (sort === "price-asc") arr.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") arr.sort((a, b) => b.price - a.price);
    else arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [listings, sort]);

  const hasMore = listings.length < total;

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const pill = (active: boolean) =>
    `rounded px-2 py-1.5 text-left ${
      active
        ? "bg-[color:var(--color-brand-soft)] font-semibold text-[color:var(--color-brand-dark)]"
        : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
    }`;

  const filterControls = (
    <>
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {t("search.type")}
        </h3>
        <div className="flex flex-col gap-1 text-sm">
          <button onClick={() => setFilter("type", "")} aria-pressed={!type} className={pill(!type)}>
            {t("search.allTypes")}
          </button>
          {LISTING_TYPES.map((ty) => (
            <button
              key={ty}
              onClick={() => setFilter("type", ty)}
              aria-pressed={type === ty}
              className={pill(type === ty)}
            >
              {t(`search.type_${ty}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {t("search.category")}
        </h3>
        <div className="flex flex-col gap-1 text-sm">
          <button onClick={() => setFilter("tag", "")} aria-pressed={!tag} className={pill(!tag)}>
            {t("search.allCategories")}
          </button>
          {tags.map((tg) => (
            <button
              key={tg.id}
              onClick={() => setFilter("tag", tg.name)}
              aria-pressed={tag === tg.name}
              className={pill(tag === tg.name)}
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
          <h1 className="truncate text-xl font-bold text-neutral-900 dark:text-neutral-50">
            {search ? `« ${search} »` : t("search.allListings")}
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm text-neutral-500 dark:text-neutral-400 sm:inline">
              {t("search.results", { count: total })}
            </span>
            <label className="sr-only" htmlFor="sort-select">
              {t("search.sortLabel")}
            </label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => setFilter("sort", e.target.value === "recent" ? "" : e.target.value)}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm text-neutral-700 dark:text-neutral-200"
            >
              <option value="recent">{t("search.sortRecent")}</option>
              <option value="price-asc">{t("search.sortPriceAsc")}</option>
              <option value="price-desc">{t("search.sortPriceDesc")}</option>
            </select>
            {/* Mobile filter trigger */}
            <button
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 md:hidden"
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
          <p className="text-neutral-500 dark:text-neutral-400">{t("common.loading")}</p>
        ) : error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300"
          >
            <p className="font-medium">{t("search.error")}</p>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-3 rounded-lg bg-[color:var(--color-brand)] px-3 py-1.5 text-sm font-semibold text-white"
            >
              {t("search.retry")}
            </button>
          </div>
        ) : sortedListings.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-400">{t("search.empty")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {sortedListings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex flex-col items-center gap-2">
                {loadMoreError && <p className="text-sm text-red-600 dark:text-red-400">{t("search.error")}</p>}
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-5 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-60"
                >
                  {loadingMore ? t("common.loading") : t("search.loadMore")}
                </button>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {t("search.loadedCount", { loaded: listings.length, total })}
                </span>
              </div>
            )}
          </>
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
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-neutral-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl outline-none"
          >
            <h2 id="filter-sheet-title" className="sr-only">
              {t("search.filters")}
            </h2>
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
