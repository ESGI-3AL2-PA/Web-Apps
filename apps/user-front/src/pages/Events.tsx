import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { AuthUser } from "@repo/hooks";
import type { EventResponseDto } from "@repo/contracts";
import { getEvents, markInterest, registerToEvent, unregisterFromEvent } from "../api-service/events.service";
import { getRecommendedEvents } from "../api-service/recommendations.service";
import { formatDateTime } from "../lib/format";
import { useDialog } from "../components/dialog-context";
import ErrorBanner from "../components/ErrorBanner";
import NewEventModal from "../components/NewEventModal";

// Page : liste des événements du quartier + bande de recommandations personnalisées,
// avec inscription/désinscription et signaux d'intérêt (pouce haut/bas) alimentant le moteur de reco.

/**
 * Carte d'un événement : titre, statut, places restantes, date/lieu, bouton
 * d'inscription et boutons d'intérêt (visibles seulement si connecté).
 * @param busy id de l'événement en cours de mutation (désactive son bouton).
 * @param interest intérêt local pour cet événement (1 = intéressé, -1 = pas intéressé).
 */
function EventCard({
  ev,
  user,
  busy,
  interest,
  onToggle,
  onInterest,
}: {
  ev: EventResponseDto;
  user: AuthUser | null;
  busy: string | null;
  interest: 1 | -1 | undefined;
  onToggle: (ev: EventResponseDto) => void;
  onInterest: (ev: EventResponseDto, rating: 1 | -1) => void;
}) {
  const { t } = useTranslation();
  const isRegistered = user ? ev.registrants.includes(user.id) : false;
  // « Complet » ne s'applique que si l'utilisateur n'est pas déjà inscrit.
  const full = ev.remainingSeats <= 0 && !isRegistered;
  // « Terminé » : tout statut qui n'est ni à venir ni en cours.
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
      {user && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            aria-label={t("events.interested")}
            title={t("events.interested")}
            onClick={() => onInterest(ev, 1)}
            className={`btn btn-sm flex-1 ${interest === 1 ? "btn-primary" : "btn-soft"}`}
          >
            <span className="icon-[tabler--thumb-up] size-4" />
          </button>
          <button
            type="button"
            aria-label={t("events.notInterested")}
            title={t("events.notInterested")}
            onClick={() => onInterest(ev, -1)}
            className={`btn btn-sm flex-1 ${interest === -1 ? "btn-primary" : "btn-soft"}`}
          >
            <span className="icon-[tabler--thumb-down] size-4" />
          </button>
        </div>
      )}
    </article>
  );
}

/**
 * Page des événements : charge la liste complète et, pour un utilisateur
 * connecté, une bande de recommandations personnalisées ; gère inscription et
 * signaux d'intérêt.
 */
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
  const [creating, setCreating] = useState(false);
  const [interest, setInterest] = useState<Record<string, 1 | -1>>({});

  const load = useCallback(() => {
    let ignore = false;
    setLoading(true);
    setError(false);
    getEvents()
      .then((e) => {
        if (!ignore) setEvents(e);
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

  // Bande « pour vous » personnalisée (filtrage collaboratif, nécessite d'être connecté).
  useEffect(() => {
    if (!user?.id) return;
    let ignore = false;
    setLoadingReco(true);
    getRecommendedEvents(6)
      .then((r) => {
        if (!ignore) setRecommended(r);
      })
      .catch(() => {
        if (!ignore) setRecommended([]);
      })
      .finally(() => {
        if (!ignore) setLoadingReco(false);
      });
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  // Signal de goût « fire-and-forget » pour le moteur de reco. Optimiste ; revert
  // en cas d'échec. L'état est local à la session — EventResponseDto ne persiste
  // pas d'intérêt par utilisateur.
  const onInterest = async (ev: EventResponseDto, rating: 1 | -1) => {
    if (!user) return;
    const prev = interest[ev.id];
    // Re-cliquer sur le même intérêt le retire (bascule).
    const next = prev === rating ? undefined : rating;
    setInterest((m) => {
      const copy = { ...m };
      if (next) copy[ev.id] = next;
      else delete copy[ev.id];
      return copy;
    });
    // Désélection : rien à envoyer au serveur.
    if (!next) return;
    try {
      await markInterest(ev.id, next);
    } catch {
      // Échec : on rétablit l'état d'intérêt précédent.
      setInterest((m) => {
        const copy = { ...m };
        if (prev) copy[ev.id] = prev;
        else delete copy[ev.id];
        return copy;
      });
      await alert({ message: t("events.actionError") });
    }
  };

  const toggle = async (ev: EventResponseDto) => {
    if (!user) return;
    const isRegistered = ev.registrants.includes(user.id);
    setBusy(ev.id);
    try {
      const updated = isRegistered ? await unregisterFromEvent(ev.id) : await registerToEvent(ev.id);
      // On applique la version renvoyée aux deux listes (toutes + recommandées).
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-base-content">{t("events.title")}</h1>
          <p className="text-base-content/60">{t("events.subtitle")}</p>
        </div>
        {user?.districtId && (
          <button onClick={() => setCreating(true)} className="btn btn-primary btn-sm shrink-0">
            <span className="icon-[tabler--plus] size-4" />
            {t("events.create")}
          </button>
        )}
      </div>

      {creating && (
        <NewEventModal onClose={() => setCreating(false)} onCreated={(ev) => setEvents((prev) => [ev, ...prev])} />
      )}

      {user && (loadingReco || recommended.length > 0) && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-base-content">🎯 {t("events.forYou")}</h2>
          {loadingReco ? (
            <p className="text-sm text-base-content/60">{t("events.forYouLoading")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((ev) => (
                <EventCard
                  key={ev.id}
                  ev={ev}
                  user={user}
                  busy={busy}
                  interest={interest[ev.id]}
                  onToggle={toggle}
                  onInterest={onInterest}
                />
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
            <EventCard
              key={ev.id}
              ev={ev}
              user={user}
              busy={busy}
              interest={interest[ev.id]}
              onToggle={toggle}
              onInterest={onInterest}
            />
          ))}
        </div>
      )}
    </div>
  );
}
