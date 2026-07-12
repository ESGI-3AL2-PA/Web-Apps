import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { EventResponseDto } from "@repo/contracts";
import { getEvents, registerToEvent, unregisterFromEvent } from "../api-service/events.service";
import { formatDateTime } from "../lib/format";

export default function Events() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getEvents()
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const toggle = async (ev: EventResponseDto) => {
    if (!user) return;
    const isRegistered = ev.registrants.includes(user.id);
    setBusy(ev.id);
    try {
      const updated = isRegistered ? await unregisterFromEvent(ev.id) : await registerToEvent(ev.id);
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? updated : e)));
    } catch {
      alert(t("events.actionError"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-900">{t("events.title")}</h1>
        <p className="text-neutral-500">{t("events.subtitle")}</p>
      </div>

      {loading ? (
        <p className="text-neutral-500">{t("common.loading")}</p>
      ) : events.length === 0 ? (
        <p className="text-neutral-500">{t("events.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => {
            const isRegistered = user ? ev.registrants.includes(user.id) : false;
            const full = ev.remainingSeats <= 0 && !isRegistered;
            const closed = ev.status !== "upcoming" && ev.status !== "ongoing";
            return (
              <article key={ev.id} className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-full bg-[color:var(--color-brand-soft)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--color-brand-dark)]">
                    {t(`events.status.${ev.status}`, { defaultValue: ev.status })}
                  </span>
                  <span className="text-xs text-neutral-400">{t("events.seats", { count: ev.remainingSeats })}</span>
                </div>
                <h2 className="text-lg font-bold text-neutral-900">{ev.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{ev.description}</p>
                <dl className="mt-3 space-y-1 text-sm text-neutral-700">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>{formatDateTime(ev.eventDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span>{ev.location}</span>
                  </div>
                </dl>
                <button
                  onClick={() => toggle(ev)}
                  disabled={busy === ev.id || closed || full}
                  className={`mt-4 rounded-lg py-2 text-sm font-semibold ${
                    isRegistered
                      ? "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                      : "bg-[color:var(--color-brand)] text-white hover:bg-[color:var(--color-brand-dark)]"
                  } disabled:opacity-50`}
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
          })}
        </div>
      )}
    </div>
  );
}
