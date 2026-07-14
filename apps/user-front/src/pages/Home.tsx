import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { EventResponseDto, ListingResponseDto, TagResponseDto, VoteResponseDto } from "@repo/contracts";
import { getListings } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import { getEvents } from "../api-service/events.service";
import { getVotes } from "../api-service/votes.service";
import ListingCard from "../components/ListingCard";
import { formatDateTime, formatPrice } from "../lib/format";

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingResponseDto[]>([]);
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [events, setEvents] = useState<EventResponseDto[]>([]);
  const [votes, setVotes] = useState<VoteResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getListings({ status: "active", limit: 24 }),
      getTags(),
      getEvents({ status: "upcoming", limit: 3 }).catch(() => []),
      getVotes({ status: "open", limit: 3 }).catch(() => []),
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
      {user && (
        <Link
          to="/profil"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[color:var(--color-brand)] p-5 text-white transition hover:bg-[color:var(--color-brand-dark)]"
        >
          <div>
            <p className="text-lg font-bold">{t("home.greeting", { name: user.firstName })}</p>
            <p className="text-sm text-white/90">{t("home.balanceLabel")}</p>
          </div>
          <span className="rounded-lg bg-white/15 px-4 py-2 text-xl font-extrabold">{formatPrice(user.balance)}</span>
        </Link>
      )}

      {tags.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-neutral-900 dark:text-neutral-50">{t("home.categories")}</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => navigate(`/recherche?tag=${encodeURIComponent(tag.name)}`)}
                className="rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
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
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{t("home.upcomingEvents")}</h2>
              <Link
                to="/evenements"
                className="text-sm font-medium text-[color:var(--color-brand-dark)] hover:underline"
              >
                {t("home.seeAll")}
              </Link>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("home.noEvents")}</p>
            ) : (
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <Link
                      to="/evenements"
                      className="flex items-center gap-3 rounded-lg border border-neutral-100 dark:border-neutral-800 p-2 hover:bg-[color:var(--color-brand-soft)]"
                    >
                      <span className="text-xl">📅</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-neutral-800 dark:text-neutral-100">
                          {ev.title}
                        </span>
                        <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                          {formatDateTime(ev.eventDate)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sondages du quartier */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                {t("home.neighbourhoodPolls")}
              </h2>
              <Link to="/sondages" className="text-sm font-medium text-[color:var(--color-brand-dark)] hover:underline">
                {t("home.participate")}
              </Link>
            </div>
            {votes.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("home.noPolls")}</p>
            ) : (
              <ul className="space-y-2">
                {votes.map((v) => (
                  <li key={v.id}>
                    <Link
                      to="/sondages"
                      className="flex items-center gap-3 rounded-lg border border-neutral-100 dark:border-neutral-800 p-2 hover:bg-[color:var(--color-brand-soft)]"
                    >
                      <span className="text-xl">🗳️</span>
                      <span className="block min-w-0 truncate font-medium text-neutral-800 dark:text-neutral-100">
                        {v.question}
                      </span>
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
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{t("home.recentListings")}</h2>
          <Link to="/recherche" className="text-sm font-medium text-[color:var(--color-brand-dark)] hover:underline">
            {t("home.seeAll")}
          </Link>
        </div>
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">{t("common.loading")}</p>
        ) : listings.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-400">{t("home.empty")}</p>
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
