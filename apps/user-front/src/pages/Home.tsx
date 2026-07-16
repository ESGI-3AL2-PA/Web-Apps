import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { EventResponseDto, ListingResponseDto, TagResponseDto, VoteResponseDto } from "@repo/contracts";
import { getListings } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import { tagLabel } from "../lib/tag-label";
import { getEvents } from "../api-service/events.service";
import { getVotes } from "../api-service/votes.service";
import ListingCard from "../components/ListingCard";
import ErrorBanner from "../components/ErrorBanner";
import { formatDateTime, formatPrice } from "../lib/format";

export default function Home() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingResponseDto[]>([]);
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [events, setEvents] = useState<EventResponseDto[]>([]);
  const [votes, setVotes] = useState<VoteResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    let ignore = false;
    setLoading(true);
    setError(false);
    Promise.all([
      getListings({ status: "active", limit: 24 }),
      getTags(),
      getEvents({ status: "upcoming", limit: 3 }).catch(() => []),
      getVotes({ status: "open", limit: 3 }).catch(() => []),
    ])
      .then(([page, tags, ev, vo]) => {
        if (ignore) return;
        setListings(page.data);
        setTags(tags);
        setEvents(ev);
        setVotes(vo);
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
  }, []);

  useEffect(load, [load]);

  return (
    <div className="space-y-8">
      {user && (
        <Link
          to="/profil"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary p-5 text-primary-content transition hover:bg-primary/90"
        >
          <div>
            <p className="text-lg font-bold">{t("home.greeting", { name: user.firstName })}</p>
            <p className="text-sm text-primary-content/90">{t("home.balanceLabel")}</p>
          </div>
          <span className="rounded-lg bg-primary-content/15 px-4 py-2 text-xl font-extrabold">
            {formatPrice(user.balance)}
          </span>
        </Link>
      )}

      {tags.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-base-content">{t("home.categories")}</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => navigate(`/recherche?tag=${encodeURIComponent(tag.name)}`)}
                className="rounded-full border border-base-content/20 bg-base-100 px-4 py-1.5 text-sm font-medium text-base-content/80 hover:border-primary hover:text-primary"
              >
                {tagLabel(tag, i18n.language)}
              </button>
            ))}
          </div>
        </section>
      )}

      {(events.length > 0 || votes.length > 0) && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Événements à venir */}
          <div className="card border border-base-content/10 bg-base-100 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-base-content">{t("home.upcomingEvents")}</h2>
              <Link to="/evenements" className="text-sm font-medium text-primary hover:underline">
                {t("home.seeAll")}
              </Link>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-base-content/60">{t("home.noEvents")}</p>
            ) : (
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <Link
                      to="/evenements"
                      className="flex items-center gap-3 rounded-lg border border-base-content/10 p-2 hover:bg-base-200"
                    >
                      <span className="icon-[tabler--calendar-event] size-5 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-base-content/80">{ev.title}</span>
                        <span className="block text-xs text-base-content/60">{formatDateTime(ev.eventDate)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sondages du quartier */}
          <div className="card border border-base-content/10 bg-base-100 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-base-content">{t("home.neighbourhoodPolls")}</h2>
              <Link to="/sondages" className="text-sm font-medium text-primary hover:underline">
                {t("home.participate")}
              </Link>
            </div>
            {votes.length === 0 ? (
              <p className="text-sm text-base-content/60">{t("home.noPolls")}</p>
            ) : (
              <ul className="space-y-2">
                {votes.map((v) => (
                  <li key={v.id}>
                    <Link
                      to="/sondages"
                      className="flex items-center gap-3 rounded-lg border border-base-content/10 p-2 hover:bg-base-200"
                    >
                      <span className="icon-[tabler--chart-bar] size-5 text-primary" />
                      <span className="block min-w-0 truncate font-medium text-base-content/80">{v.question}</span>
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
          <h2 className="text-lg font-bold text-base-content">{t("home.recentListings")}</h2>
          <Link to="/recherche" className="text-sm font-medium text-primary hover:underline">
            {t("home.seeAll")}
          </Link>
        </div>
        {loading ? (
          <p className="text-base-content/60">{t("common.loading")}</p>
        ) : error ? (
          <ErrorBanner onRetry={load} />
        ) : listings.length === 0 ? (
          <p className="text-base-content/60">{t("home.empty")}</p>
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
