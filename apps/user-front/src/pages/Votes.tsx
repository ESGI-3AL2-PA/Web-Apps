import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { VoteResponseDto } from "@repo/contracts";
import { getVotes, submitVote } from "../api-service/votes.service";
import { useDialog } from "../components/dialog-context";
import ErrorBanner from "../components/ErrorBanner";

function PollResults({ vote }: { vote: VoteResponseDto }) {
  const { t } = useTranslation();
  const total = vote.totalResponses ?? vote.results.reduce((s, r) => s + r.count, 0);
  return (
    <div className="mt-3 space-y-2">
      {vote.results.map((r) => {
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
        const mine = vote.myChosenOptions?.includes(r.option);
        return (
          <div key={r.option}>
            <div className="mb-0.5 flex justify-between text-sm">
              <span className={mine ? "font-semibold text-primary" : "text-base-content/80"}>
                {r.option} {mine && "✓"}
              </span>
              <span className="text-base-content/60">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-base-200">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-xs text-base-content/60">{t("votes.responses", { count: total })}</p>
    </div>
  );
}

function PollCard({ vote, onVoted }: { vote: VoteResponseDto; onVoted: (v: VoteResponseDto) => void }) {
  const { t } = useTranslation();
  const { alert } = useDialog();
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
      await alert({ message: t("votes.error") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-box border border-base-content/10 bg-base-100 p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="badge badge-primary badge-soft">
          {vote.status === "closed" ? t("votes.closed") : t("votes.open")}
        </span>
        {multi && <span className="text-xs text-base-content/60">{t("votes.multipleChoice")}</span>}
      </div>
      <h2 className="text-lg font-bold text-base-content">{vote.question}</h2>

      {voted ? (
        <PollResults vote={vote} />
      ) : multi ? (
        <div className="mt-3 space-y-2">
          {vote.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-base-content/80">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
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
            className="btn btn-primary btn-sm mt-1"
          >
            {t("votes.vote")}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {vote.options.map((opt) => (
            <button
              key={opt}
              onClick={() => cast([opt])}
              disabled={busy}
              className="rounded-lg border border-base-content/20 px-4 py-2 text-left text-sm font-medium text-base-content hover:border-primary hover:bg-primary/10 disabled:opacity-50"
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
  const { t } = useTranslation();
  const [votes, setVotes] = useState<VoteResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    let ignore = false;
    setLoading(true);
    setError(false);
    getVotes()
      .then((v) => {
        if (!ignore) setVotes(v);
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

  const onVoted = (updated: VoteResponseDto) =>
    setVotes((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-base-content">{t("votes.title")}</h1>
        <p className="text-base-content/60">{t("votes.subtitle")}</p>
      </div>

      {loading ? (
        <p className="text-base-content/60">{t("common.loading")}</p>
      ) : error ? (
        <ErrorBanner onRetry={load} />
      ) : votes.length === 0 ? (
        <p className="text-base-content/60">{t("votes.empty")}</p>
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
