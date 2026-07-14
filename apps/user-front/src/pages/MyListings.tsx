import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ListingResponseDto } from "@repo/contracts";
import { deleteListing, getListings } from "../api-service/listings.service";
import { formatPrice, formatRelative } from "../lib/format";
import { useDialog } from "../components/dialog-context";
import AuthedImage from "../components/AuthedImage";

export default function MyListings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { confirm, alert } = useDialog();
  const [listings, setListings] = useState<ListingResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    getListings({ authorId: user.id, limit: 100 } as never)
      .then((page) => setListings(page.data))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(load, [load]);

  const onDelete = async (id: string) => {
    const ok = await confirm({
      title: t("myListings.title"),
      message: t("myListings.confirmDelete"),
      confirmLabel: t("myListings.delete"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteListing(id);
      setListings((prev) => prev.filter((l) => l.id !== id));
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
                <Link
                  to={`/annonce/${l.id}`}
                  className="block truncate font-semibold text-neutral-900 dark:text-neutral-50 hover:text-[color:var(--color-brand)]"
                >
                  {l.title}
                </Link>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {formatPrice(l.price)} · {formatRelative(l.createdAt)}
                </p>
              </div>
              <button
                onClick={() => onDelete(l.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                {t("myListings.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
