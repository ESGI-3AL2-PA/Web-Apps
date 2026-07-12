import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { EventResponseDto, ListingResponseDto, TagResponseDto, VoteResponseDto } from "@repo/contracts";
import { getListings } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import { getEvents } from "../api-service/events.service";
import { getVotes } from "../api-service/votes.service";
import ListingCard from "../components/ListingCard";
import { formatDateTime } from "../lib/format";

export default function Home() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<ListingResponseDto[]>([]);
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [events, setEvents] = useState<EventResponseDto[]>([]);
  const [votes, setVotes] = useState<VoteResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getListings({ status: "active", limit: 24 } as never),
      getTags(),
      getEvents({ status: "upcoming", limit: 3 } as never).catch(() => []),
      getVotes({ status: "open", limit: 3 } as never).catch(() => []),
    ])
      .then(([page, t, ev, vo]) => {
        setListings(page.data);
        setTags(t);
        setEvents(ev);
        setVotes(vo);
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-r from-[color:var(--color-brand)] to-indigo-400 px-6 py-10 text-white">
        <h1 className="text-3xl font-extrabold">Vos petites annonces entre voisins</h1>
        <p className="mt-2 max-w-xl text-white/90">
          Achetez, vendez et rendez service près de chez vous. Déposez votre annonce en quelques secondes.
        </p>
        <Link
          to="/deposer"
          className="mt-5 inline-block rounded-lg bg-white px-5 py-2.5 font-semibold text-[color:var(--color-brand-dark)] shadow hover:bg-neutral-50"
        >
          Déposer une annonce
        </Link>
      </section>

      {tags.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-neutral-900">Catégories</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => navigate(`/recherche?tag=${encodeURIComponent(tag.name)}`)}
                className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
              >
                {tag.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {(events.length > 0 || votes.length > 0) && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Événements à venir */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900">Événements à venir</h2>
              <Link to="/evenements" className="text-sm font-medium text-[color:var(--color-brand)] hover:underline">
                Tout voir
              </Link>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-neutral-500">Aucun événement prévu.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <Link
                      to="/evenements"
                      className="flex items-center gap-3 rounded-lg border border-neutral-100 p-2 hover:bg-[color:var(--color-brand-soft)]"
                    >
                      <span className="text-xl">📅</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-neutral-800">{ev.title}</span>
                        <span className="block text-xs text-neutral-500">{formatDateTime(ev.eventDate)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sondages du quartier */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900">Sondages du quartier</h2>
              <Link to="/sondages" className="text-sm font-medium text-[color:var(--color-brand)] hover:underline">
                Participer
              </Link>
            </div>
            {votes.length === 0 ? (
              <p className="text-sm text-neutral-500">Aucun sondage en cours.</p>
            ) : (
              <ul className="space-y-2">
                {votes.map((v) => (
                  <li key={v.id}>
                    <Link
                      to="/sondages"
                      className="flex items-center gap-3 rounded-lg border border-neutral-100 p-2 hover:bg-[color:var(--color-brand-soft)]"
                    >
                      <span className="text-xl">🗳️</span>
                      <span className="block min-w-0 truncate font-medium text-neutral-800">{v.question}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">Annonces récentes</h2>
          <Link to="/recherche" className="text-sm font-medium text-[color:var(--color-brand)] hover:underline">
            Tout voir
          </Link>
        </div>
        {loading ? (
          <p className="text-neutral-500">Chargement…</p>
        ) : listings.length === 0 ? (
          <p className="text-neutral-500">Aucune annonce pour le moment. Soyez le premier à en déposer une !</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
