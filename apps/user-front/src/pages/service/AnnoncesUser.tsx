import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ListingResponseDto } from "@repo/contracts";
import { deleteListing, getListings } from "../../api-service/api";
import ListingCard from "../../component/ListingCard";

const AnnoncesUser = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<ListingResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchMine = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const res = await getListings({ authorId: user.id, limit: 50 });
      setData(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("myListings.confirmDelete"))) return;
    const previous = data;
    setData((prev) => prev.filter((l) => l.id !== id));
    try {
      await deleteListing(id);
    } catch {
      setData(previous);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-40 w-full rounded-box" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-base-content/70">{t("myListings.loadError")}</p>
        <button className="btn btn-primary btn-sm" onClick={fetchMine}>
          {t("annonces.retry")}
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="text-4xl" aria-hidden="true">
          📭
        </span>
        <p className="text-base-content/70">{t("myListings.empty")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((listing) => (
        <ListingCard key={listing.id} listing={listing} onDelete={handleDelete} />
      ))}
    </div>
  );
};

export default AnnoncesUser;
