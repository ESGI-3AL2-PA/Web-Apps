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
    setLoading(true);
    setError(false);
    getListings({ authorId: user.id, limit: 100 })
      .then((page) => setListings(page.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
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
        <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">{t("myListings.title")}</h1>
        <Link
          to="/deposer"
          className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
        >
          {t("myListings.deposit")}
        </Link>
      </div>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">{t("common.loading")}</p>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-red-700 dark:text-red-300">{t("myListings.loadError")}</p>
          <button
            onClick={load}
            className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
          >
            {t("myListings.retry")}
          </button>
        </div>
      ) : listings.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400">{t("myListings.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                {l.images?.[0] && <AuthedImage src={l.images[0]} className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/annonce/${l.id}`}
                    className="block truncate font-semibold text-neutral-900 dark:text-neutral-50 hover:text-[color:var(--color-brand)]"
                  >
                    {l.title}
                  </Link>
                  {l.userHasContract && (
                    <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {t("myListings.activeBadge")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {formatPrice(l.price)} · {formatRelative(l.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setEditing(l)}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                {t("myListings.edit")}
              </button>
              <button
                onClick={() => onDelete(l)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
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
