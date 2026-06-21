import { useCallback, useEffect, useState } from "react";
import type { VoteQueryDto, VoteResponseDto, VoteStatus } from "@repo/contracts";
import { getVotes } from "../api-service/votes.service";
import VoteList from "../component/VoteList";

const STATUS_OPTIONS: { value: VoteStatus | ""; label: string }[] = [
  { value: "", label: "Tous statuts" },
  { value: "open", label: "Ouverts" },
  { value: "closed", label: "Clos" },
  { value: "draft", label: "Brouillons" },
];

// Page user — consultation des votes du quartier + soumission via CarteVote.
// Les créations / clôtures de votes sont admin-only (admin-front).
const Votes = () => {
  const [votes, setVotes] = useState<VoteResponseDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VoteStatus | "">("open");
  const [search, setSearch] = useState<string>("");

  const fetchVotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: VoteQueryDto = { limit: 50 } as VoteQueryDto;
      if (status) filters.status = status;
      if (search) filters.search = search;
      const res = await getVotes(filters);
      setVotes(res.data);
    } catch {
      setError("Impossible de charger les votes");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 24px 0" }}>Votes du quartier</h1>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <select
          className="border border-black rounded px-2 py-1"
          value={status}
          onChange={(e) => setStatus(e.target.value as VoteStatus | "")}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          className="border border-black rounded px-2 py-1"
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Chargement des votes…</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <VoteList votes={votes} title="" onChanged={fetchVotes} />
      )}
    </div>
  );
};

export default Votes;
