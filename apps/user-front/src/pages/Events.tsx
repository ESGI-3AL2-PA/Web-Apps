import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { AuthUser } from "@repo/hooks";
import type { EventResponseDto } from "@repo/contracts";
import { getEvents, registerToEvent, unregisterFromEvent } from "../api-service/events.service";
import { getRecommendedEvents } from "../api-service/recommendations.service";
import { formatDateTime } from "../lib/format";
import { useDialog } from "../components/dialog-context";
import ErrorBanner from "../components/ErrorBanner";

function EventCard({
  ev,
  user,
  busy,
  onToggle,
}: {
  ev: EventResponseDto;
  user: AuthUser | null;
  busy: string | null;
  onToggle: (ev: EventResponseDto) => void;
}) {
  const { t } = useTranslation();
  const isRegistered = user ? ev.registrants.includes(user.id) : false;
  const full = ev.remainingSeats <= 0 && !isRegistered;
  const closed = ev.status !== "upcoming" && ev.status !== "ongoing";

  return (
    <article className="flex flex-col rounded-xl border border-base-content/10 bg-base-100 p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {t(`events.status.${ev.status}`, { defaultValue: ev.status })}
        </span>
        <span className="text-xs text-base-content/60">{t("events.seats", { count: ev.remainingSeats })}</span>
      </div>
      <h2 className="text-lg font-bold text-base-content">{ev.title}</h2>
      <p className="mt-1 line-clamp-2 text-sm text-base-content/70">{ev.description}</p>
      <dl className="mt-3 space-y-1 text-sm text-base-content/80">
        <div className="flex items-center gap-2">
          <span className="icon-[tabler--calendar-event] size-4" />
          <span>{formatDateTime(ev.eventDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="icon-[tabler--map-pin] size-4" />
          <span>{ev.location}</span>
        </div>
      </dl>
      <button
        onClick={() => onToggle(ev)}
        disabled={busy === ev.id || closed || full}
        className={`btn btn-block mt-4 ${isRegistered ? "btn-soft" : "btn-primary"}`}
      >
        {closed
          ? t("events.finished")
          : full
            ? t("events.full")
            : isRegistered
              ? t("events.unregister")
              : t("events.participate")}
      </button>
    </article>
  );
}

export default function Events() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { alert } = useDialog();
  const [events, setEvents] = useState<EventResponseDto[]>([]);
  const [recommended, setRecommended] = useState<EventResponseDto[]>([]);
  const [loadingReco, setLoadingReco] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getEvents()
      .then(setEvents)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // Personalized "for you" strip (collaborative filtering, requires auth).
  useEffect(() => {
    if (!user?.id) return;
    setLoadingReco(true);
    getRecommendedEvents(6)
      .then(setRecommended)
      .catch(() => setRecommended([]))
      .finally(() => setLoadingReco(false));
  }, [user?.id]);

  const toggle = async (ev: EventResponseDto) => {
    if (!user) return;
    const isRegistered = ev.registrants.includes(user.id);
    setBusy(ev.id);
    try {
      const updated = isRegistered ? await unregisterFromEvent(ev.id) : await registerToEvent(ev.id);
      const patch = (list: EventResponseDto[]) => list.map((e) => (e.id === ev.id ? updated : e));
      setEvents(patch);
      setRecommended(patch);
    } catch {
      await alert({ message: t("events.actionError") });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-base-content">{t("events.title")}</h1>
        <p className="text-base-content/60">{t("events.subtitle")}</p>
      </div>

      {user && (loadingReco || recommended.length > 0) && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-base-content">🎯 {t("events.forYou")}</h2>
          {loadingReco ? (
            <p className="text-sm text-base-content/60">{t("events.forYouLoading")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((ev) => (
                <EventCard key={ev.id} ev={ev} user={user} busy={busy} onToggle={toggle} />
              ))}
            </div>
          )}
        </section>
      )}

      {loading ? (
        <p className="text-base-content/60">{t("common.loading")}</p>
      ) : error ? (
        <ErrorBanner onRetry={load} />
      ) : events.length === 0 ? (
        <p className="text-base-content/60">{t("events.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard key={ev.id} ev={ev} user={user} busy={busy} onToggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}
