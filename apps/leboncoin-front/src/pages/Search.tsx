import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ListingQueryDto, ListingResponseDto, TagResponseDto } from "@repo/contracts";
import { getListings } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import ListingCard from "../components/ListingCard";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState<ListingResponseDto[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  const search = params.get("search") ?? "";
  const tag = params.get("tag") ?? "";
  const type = params.get("type") ?? "";

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

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
      <aside className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">Type</h3>
          <div className="flex flex-col gap-1 text-sm">
            {[
              { v: "", label: "Tout" },
              { v: "offer", label: "Offres" },
              { v: "request", label: "Demandes" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setFilter("type", o.v)}
                className={`rounded px-2 py-1 text-left ${
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
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">Catégorie</h3>
          <div className="flex flex-col gap-1 text-sm">
            <button
              onClick={() => setFilter("tag", "")}
              className={`rounded px-2 py-1 text-left ${!tag ? "bg-[color:var(--color-brand-soft)] font-semibold text-[color:var(--color-brand-dark)]" : "hover:bg-neutral-100"}`}
            >
              Toutes
            </button>
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter("tag", t.name)}
                className={`rounded px-2 py-1 text-left ${
                  tag === t.name
                    ? "bg-[color:var(--color-brand-soft)] font-semibold text-[color:var(--color-brand-dark)]"
                    : "hover:bg-neutral-100"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-xl font-bold text-neutral-900">{search ? `« ${search} »` : "Toutes les annonces"}</h1>
          <span className="text-sm text-neutral-500">
            {total} résultat{total > 1 ? "s" : ""}
          </span>
        </div>
        {loading ? (
          <p className="text-neutral-500">Chargement…</p>
        ) : listings.length === 0 ? (
          <p className="text-neutral-500">Aucune annonce ne correspond à votre recherche.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
