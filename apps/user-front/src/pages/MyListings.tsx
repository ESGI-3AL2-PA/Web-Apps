import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ListingResponseDto } from "@repo/contracts";
import { deleteListing, getListings } from "../api-service/listings.service";
import { formatPrice, formatRelative } from "../lib/format";
import { useDialog } from "../components/dialog-context";
import AuthedImage from "../components/AuthedImage";
import EditListingModal from "../components/EditListingModal";

export default function MyListings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { confirm, alert } = useDialog();
  const [listings, setListings] = useState<ListingResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<ListingResponseDto | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    let ignore = false;
    setLoading(true);
    setError(false);
    getListings({ authorId: user.id, limit: 100 })
      .then((page) => {
        if (!ignore) setListings(page.data);
      })
      .catch(() => {
        if (!ignore) setError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [user]);

  useEffect(load, [load]);

  const onDelete = async (listing: ListingResponseDto) => {
    const ok = await confirm({
      title: t("myListings.title"),
      message: listing.userHasContract ? t("myListings.confirmDeleteActive") : t("myListings.confirmDelete"),
      confirmLabel: t("myListings.delete"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteListing(listing.id);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
    } catch {
      await alert({ message: t("myListings.deleteError") });
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-base-content">{t("myListings.title")}</h1>
        <Link
          to="/deposer"
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-content hover:bg-primary/90"
        >
          {t("myListings.deposit")}
        </Link>
      </div>

      {loading ? (
        <p className="text-base-content/60">{t("common.loading")}</p>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-error/20 bg-error/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-error">{t("myListings.loadError")}</p>
          <button
            onClick={load}
            className="rounded-lg border border-error/30 px-3 py-1.5 text-sm font-medium text-error hover:bg-error/10"
          >
            {t("myListings.retry")}
          </button>
        </div>
      ) : listings.length === 0 ? (
        <p className="text-base-content/60">{t("myListings.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => (
            <li key={l.id} className="flex items-center gap-4 rounded-xl border border-base-content/10 bg-base-100 p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-base-200">
                {l.images?.[0] && <AuthedImage src={l.images[0]} className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/annonce/${l.id}`}
                    className="block truncate font-semibold text-base-content hover:text-primary"
                  >
                    {l.title}
                  </Link>
                  {l.userHasContract && (
                    <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                      {t("myListings.activeBadge")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-base-content/60">
                  {formatPrice(l.price)} · {formatRelative(l.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setEditing(l)}
                className="rounded-lg border border-base-content/10 px-3 py-1.5 text-sm font-medium text-base-content/80 hover:bg-base-200"
              >
                {t("myListings.edit")}
              </button>
              <button
                onClick={() => onDelete(l)}
                className="rounded-lg border border-error/20 px-3 py-1.5 text-sm font-medium text-error hover:bg-error/10"
              >
                {t("myListings.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditListingModal
          listing={editing}
          onClose={() => setEditing(null)}
          onUpdated={(updated) => setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))}
        />
      )}
    </div>
  );
}
