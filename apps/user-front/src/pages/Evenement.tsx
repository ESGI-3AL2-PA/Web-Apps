import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { EventResponseDto, EventStatus } from "@repo/contracts";
import { getEvents, registerToEvent, unregisterFromEvent } from "../api-service/api";

const statusBadgeClass: Record<EventStatus, string> = {
  upcoming: "badge-info",
  ongoing: "badge-success",
  completed: "badge-neutral",
  cancelled: "badge-error",
};

const Evenement = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getEvents({ limit: 50 });
      setEvents([...res.data].sort((a, b) => a.eventDate.localeCompare(b.eventDate)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const toggle = async (ev: EventResponseDto, registered: boolean) => {
    setBusyId(ev.id);
    try {
      const updated = registered ? await unregisterFromEvent(ev.id) : await registerToEvent(ev.id);
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch {
      /* no-op */
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-48 w-full rounded-box" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-base-content/70">{t("events.loadError")}</p>
        <button className="btn btn-primary btn-sm" onClick={fetchEvents}>
          {t("annonces.retry")}
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="text-4xl" aria-hidden="true">
          📅
        </span>
        <p className="text-base-content/70">{t("events.empty")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2 xl:grid-cols-3">
      {events.map((ev) => {
        const registered = !!user && ev.registrants.includes(user.id);
        const isFull = ev.remainingSeats <= 0 && !registered;
        const canAct = ev.status === "upcoming" && (registered || !isFull);
        return (
          <article key={ev.id} className="card border border-base-content/10 bg-base-100 shadow-sm">
            <div className="card-body gap-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="card-title text-lg">{ev.title}</h2>
                <span className={`badge shrink-0 ${statusBadgeClass[ev.status]}`}>
                  {t(`events.status.${ev.status}`)}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-base-content/70">{ev.description}</p>
              <p className="text-sm text-base-content/80">📍 {ev.location}</p>
              <p className="text-sm text-base-content/80">🗓️ {formatDate(ev.eventDate)}</p>
              <p className="text-sm text-base-content/60">
                {t("events.seats", { remaining: ev.remainingSeats, total: ev.totalSeats })}
              </p>
              <div className="mt-2">
                {isFull ? (
                  <span className="badge badge-neutral">{t("events.full")}</span>
                ) : (
                  <button
                    className={`btn btn-sm ${registered ? "btn-outline" : "btn-primary"}`}
                    disabled={!canAct || busyId === ev.id}
                    onClick={() => toggle(ev, registered)}
                  >
                    {registered ? t("events.unregister") : t("events.register")}
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default Evenement;
