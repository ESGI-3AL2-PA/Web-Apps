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
    getListings({ authorId: user.id, limit: 100 })
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
        <h1 className="text-2xl font-extrabold text-base-content">{t("myListings.title")}</h1>
        <Link to="/deposer" className="btn btn-primary">
          {t("myListings.deposit")}
        </Link>
      </div>

      {loading ? (
        <p className="text-base-content/60">{t("common.loading")}</p>
      ) : listings.length === 0 ? (
        <p className="text-base-content/60">{t("myListings.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => (
            <li
              key={l.id}
              className="card flex flex-row items-center gap-4 border border-base-content/10 bg-base-100 p-3"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-base-200">
                {l.images?.[0] && <AuthedImage src={l.images[0]} className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/annonce/${l.id}`}
                  className="block truncate font-semibold text-base-content hover:text-primary"
                >
                  {l.title}
                </Link>
                <p className="text-sm text-base-content/60">
                  {formatPrice(l.price)} · {formatRelative(l.createdAt)}
                </p>
              </div>
              <button onClick={() => onDelete(l.id)} className="btn btn-soft btn-error btn-sm">
                {t("myListings.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
