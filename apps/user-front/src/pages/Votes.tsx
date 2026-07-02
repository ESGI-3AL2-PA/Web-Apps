import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { VoteResponseDto, VoteStatus } from "@repo/contracts";
import { getVotes, submitVoteResponse } from "../api-service/api";

const statusBadgeClass: Record<VoteStatus, string> = {
  draft: "badge-neutral",
  open: "badge-success",
  closed: "badge-warning",
};

const Votes = () => {
  const { t } = useTranslation();
  const [votes, setVotes] = useState<VoteResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(new Set());

  const fetchVotes = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getVotes({ limit: 50 });
      setVotes(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  const onVoted = (updated: VoteResponseDto) => {
    setVotes((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    setVoted((prev) => new Set(prev).add(updated.id));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton h-48 w-full rounded-box" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-base-content/70">{t("votes.loadError")}</p>
        <button className="btn btn-primary btn-sm" onClick={fetchVotes}>
          {t("annonces.retry")}
        </button>
      </div>
    );
  }

  if (votes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="text-4xl" aria-hidden="true">
          🗳️
        </span>
        <p className="text-base-content/70">{t("votes.empty")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-2">
      {votes.map((v) => (
        <VoteCard key={v.id} vote={v} hasVoted={voted.has(v.id)} onVoted={onVoted} />
      ))}
    </div>
  );
};

type VoteCardProps = {
  vote: VoteResponseDto;
  hasVoted: boolean;
  onVoted: (updated: VoteResponseDto) => void;
};

const VoteCard = ({ vote, hasVoted, onVoted }: VoteCardProps) => {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showResults = vote.status === "closed" || hasVoted;
  const canVote = vote.status === "open" && !hasVoted;
  const total = vote.results.reduce((sum, r) => sum + r.count, 0);

  const submit = async () => {
    if (!choice) return;
    setSubmitting(true);
    try {
      const updated = await submitVoteResponse(vote.id, choice);
      onVoted(updated);
    } catch {
      /* no-op */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="card border border-base-content/10 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="card-title text-lg">{vote.question}</h2>
          <span className={`badge shrink-0 ${statusBadgeClass[vote.status]}`}>{t(`votes.status.${vote.status}`)}</span>
        </div>

        {showResults ? (
          <div className="flex flex-col gap-2">
            {vote.options.map((opt) => {
              const count = vote.results.find((r) => r.option === opt)?.count ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={opt} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content">{opt}</span>
                    <span className="text-base-content/60">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <span className="text-xs text-base-content/50">{t("votes.totalResponses", { count: total })}</span>
            {hasVoted && <span className="text-sm text-success">{t("votes.voted")}</span>}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {vote.options.map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`vote-${vote.id}`}
                    className="radio radio-primary radio-sm"
                    checked={choice === opt}
                    onChange={() => setChoice(opt)}
                    disabled={!canVote}
                  />
                  <span className="text-base-content">{opt}</span>
                </label>
              ))}
            </div>
            <button
              className="btn btn-primary btn-sm w-fit"
              disabled={!canVote || !choice || submitting}
              onClick={submit}
            >
              {t("votes.submit")}
            </button>
          </>
        )}
      </div>
    </article>
  );
};

export default Votes;
