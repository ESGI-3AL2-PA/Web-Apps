import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@repo/hooks";
import type { EventQueryDto, EventResponseDto, EventStatus } from "@repo/contracts";
import { createEvent, getEvents } from "../api-service/events.service";
import { getRecommendedEvents } from "../api-service/recommendations.service";
import EventList from "../component/EventList";
import EventForm from "../component/EventForm";

const STATUS_OPTIONS: { value: EventStatus | ""; label: string }[] = [
  { value: "", label: "Tous statuts" },
  { value: "upcoming", label: "À venir" },
  { value: "ongoing", label: "En cours" },
  { value: "completed", label: "Terminés" },
  { value: "cancelled", label: "Annulés" },
];

type RegistrationFilter = "all" | "mine";

const Evenement = () => {
  const { user } = useAuth();

  const [events, setEvents] = useState<EventResponseDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<EventStatus | "">("upcoming");
  const [search, setSearch] = useState<string>("");
  const [regFilter, setRegFilter] = useState<RegistrationFilter>("all");
  const [showCreate, setShowCreate] = useState<boolean>(false);

  const [recommended, setRecommended] = useState<EventResponseDto[]>([]);
  const [recoLoading, setRecoLoading] = useState<boolean>(false);

  const fetchRecommendations = useCallback(async () => {
    if (!user?.id) return;
    setRecoLoading(true);
    try {
      const res = await getRecommendedEvents(6);
      setRecommended(res);
    } catch {
      setRecommended([]);
    } finally {
      setRecoLoading(false);
    }
  }, [user?.id]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: EventQueryDto = { limit: 50 } as EventQueryDto;
      if (status) filters.status = status;
      if (search) filters.search = search;
      if (regFilter === "mine" && user?.id) filters.registrantId = user.id;
      const res = await getEvents(filters);
      setEvents(res.data);
    } catch {
      setError("Impossible de charger les événements");
    } finally {
      setLoading(false);
    }
  }, [status, search, regFilter, user?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleCreate = async (data: Parameters<typeof createEvent>[0]) => {
    await createEvent(data);
    setShowCreate(false);
    fetchEvents();
  };

  // Registration and 👍 both affect the main list and the recommendations.
  const handleChanged = useCallback(() => {
    fetchEvents();
    fetchRecommendations();
  }, [fetchEvents, fetchRecommendations]);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Événements du quartier</h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={{
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 18px",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          + Créer un événement
        </button>
      </div>

      {user?.id && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px 0" }}>🎯 Pour toi</h2>
          {recoLoading ? (
            <p style={{ color: "#666", fontSize: 13 }}>Calcul des suggestions…</p>
          ) : recommended.length === 0 ? (
            <p style={{ color: "#666", fontSize: 13 }}>
              Pas encore de suggestions. Clique sur 👍 sur quelques événements pour personnaliser tes recommandations.
            </p>
          ) : (
            <EventList events={recommended} title="" onChanged={handleChanged} />
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <select
          className="border border-black rounded px-2 py-1"
          value={status}
          onChange={(e) => setStatus(e.target.value as EventStatus | "")}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          className="border border-black rounded px-2 py-1"
          value={regFilter}
          onChange={(e) => setRegFilter(e.target.value as RegistrationFilter)}
          disabled={!user?.id}
          title={user?.id ? undefined : "Connexion requise"}
        >
          <option value="all">Toutes inscriptions</option>
          <option value="mine">Mes inscriptions</option>
        </select>

        <input
          className="border border-black rounded px-2 py-1"
          type="text"
          placeholder="Rechercher (titre)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Chargement des événements…</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <EventList events={events} title="Tous les événements" onChanged={handleChanged} />
      )}

      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 24,
              maxWidth: 500,
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Nouvel événement</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{ fontSize: 24, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <EventForm onSubmit={handleCreate} submitLabel="Créer l'événement" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Evenement;
