import { useCallback, useEffect, useState } from "react";
import type { VoteResponseDto } from "@repo/contracts";
import { getVotes, submitVote } from "../api-service/votes.service";

function PollResults({ vote }: { vote: VoteResponseDto }) {
  const total = vote.totalResponses ?? vote.results.reduce((s, r) => s + r.count, 0);
  return (
    <div className="mt-3 space-y-2">
      {vote.results.map((r) => {
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
        const mine = vote.myChosenOptions?.includes(r.option);
        return (
          <div key={r.option}>
            <div className="mb-0.5 flex justify-between text-sm">
              <span className={mine ? "font-semibold text-[color:var(--color-brand-dark)]" : "text-neutral-700"}>
                {r.option} {mine && "✓"}
              </span>
              <span className="text-neutral-500">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-[color:var(--color-brand)]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-xs text-neutral-400">{total} réponse(s)</p>
    </div>
  );
}

function PollCard({ vote, onVoted }: { vote: VoteResponseDto; onVoted: (v: VoteResponseDto) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const voted = vote.userHasVoted || vote.status === "closed";
  const multi = vote.voteType === "multiple_choice";

  const cast = async (options: string[]) => {
    if (options.length === 0) return;
    setBusy(true);
    try {
      const updated = await submitVote(vote.id, multi ? { chosenOptions: options } : { chosenOption: options[0] });
      onVoted(updated);
    } catch {
      alert("Vote impossible (sondage fermé ou déjà voté).");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-full bg-[color:var(--color-brand-soft)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--color-brand-dark)]">
          {vote.status === "closed" ? "Clôturé" : "Ouvert"}
        </span>
        {multi && <span className="text-xs text-neutral-400">choix multiple</span>}
      </div>
      <h2 className="text-lg font-bold text-neutral-900">{vote.question}</h2>

      {voted ? (
        <PollResults vote={vote} />
      ) : multi ? (
        <div className="mt-3 space-y-2">
          {vote.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) =>
                  setSelected((prev) => (e.target.checked ? [...prev, opt] : prev.filter((o) => o !== opt)))
                }
              />
              {opt}
            </label>
          ))}
          <button
            onClick={() => cast(selected)}
            disabled={busy || selected.length === 0}
            className="mt-1 rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-50"
          >
            Voter
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {vote.options.map((opt) => (
            <button
              key={opt}
              onClick={() => cast([opt])}
              disabled={busy}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-left text-sm font-medium text-neutral-800 hover:border-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-soft)] disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

export default function Votes() {
  const [votes, setVotes] = useState<VoteResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getVotes()
      .then(setVotes)
      .catch(() => setVotes([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const onVoted = (updated: VoteResponseDto) =>
    setVotes((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-neutral-900">Sondages du quartier</h1>
        <p className="text-neutral-500">Donnez votre avis sur la vie de votre quartier.</p>
      </div>

      {loading ? (
        <p className="text-neutral-500">Chargement…</p>
      ) : votes.length === 0 ? (
        <p className="text-neutral-500">Aucun sondage en cours.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {votes.map((v) => (
            <PollCard key={v.id} vote={v} onVoted={onVoted} />
          ))}
        </div>
      )}
    </div>
  );
}
