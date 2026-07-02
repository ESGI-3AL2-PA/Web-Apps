import { useCallback, useEffect, useState } from "react";
import type { ListingResponseDto } from "@repo/contracts";
import { useTranslation } from "react-i18next";
import { getListings } from "../../api-service/api";
import { useServiceContext } from "./service-context";
import ListingCard from "../../component/ListingCard";

const LIMIT = 12;

const Annonces = () => {
  const { t } = useTranslation();
  const { filters, refreshKey, setTotal } = useServiceContext();
  const [data, setData] = useState<ListingResponseDto[]>([]);
  const [total, setLocalTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Reset to first page whenever the server-side query changes.
  useEffect(() => {
    setPage(1);
  }, [filters.type, filters.search, filters.categories, filters.maxPrice]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getListings({
        page,
        limit: LIMIT,
        status: "active",
        type: filters.type,
        search: filters.search || undefined,
        tags: filters.categories.length > 0 ? filters.categories : undefined,
        maxPrice: filters.maxPrice > 0 ? filters.maxPrice : undefined,
      });
      setData(res.data);
      setLocalTotal(res.total);
      setTotal(res.total);
    } catch {
      setError(true);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [page, filters.type, filters.search, filters.categories, filters.maxPrice, setTotal]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-40 w-full rounded-box" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-base-content/70">{t("annonces.loadError")}</p>
        <button className="btn btn-primary btn-sm" onClick={fetchListings}>
          {t("annonces.retry")}
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="text-4xl" aria-hidden="true">
          🔍
        </span>
        <p className="text-base-content/70">{t("annonces.empty")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("annonces.prev")}
          </button>
          <span className="text-sm text-base-content/70">{t("annonces.page", { page, total: totalPages })}</span>
          <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t("annonces.next")}
          </button>
        </div>
      )}
    </div>
  );
};

export default Annonces;
