import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@repo/hooks";
import type { ListingResponseDto } from "@repo/contracts";
import { deleteListing, getListings } from "../api-service/listings.service";
import { formatPrice, formatRelative, typeLabel } from "../lib/format";

export default function MyListings() {
  const { user } = useAuth();
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
    if (!confirm("Supprimer cette annonce ?")) return;
    await deleteListing(id).catch(() => alert("Suppression impossible."));
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-neutral-900">Mes annonces</h1>
        <Link
          to="/deposer"
          className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
        >
          + Déposer
        </Link>
      </div>

      {loading ? (
        <p className="text-neutral-500">Chargement…</p>
      ) : listings.length === 0 ? (
        <p className="text-neutral-500">Vous n'avez pas encore d'annonce.</p>
      ) : (
        <ul className="space-y-3">
          {listings.map((l) => (
            <li key={l.id} className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                {l.images?.[0] && <img src={l.images[0]} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/annonce/${l.id}`}
                  className="block truncate font-semibold text-neutral-900 hover:text-[color:var(--color-brand)]"
                >
                  {l.title}
                </Link>
                <p className="text-sm text-neutral-500">
                  {typeLabel(l.type)} · {formatPrice(l.price)} · {formatRelative(l.createdAt)}
                </p>
              </div>
              <button
                onClick={() => onDelete(l.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
