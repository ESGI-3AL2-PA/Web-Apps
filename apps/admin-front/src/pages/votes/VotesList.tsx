import { useEffect, useState } from "react";
import { useAuth } from "@repo/hooks";
import type { VoteResponseDto, VoteResultsResponseDto, VoteStatus } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { deleteVote, getVoteResults, listVotes } from "../../api-service/votes";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatDate, shortId } from "../../lib/format";

const STATUSES: VoteStatus[] = ["draft", "open", "closed"];

export default function VotesList() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";
  const list = useScopedList<VoteResponseDto>(listVotes);
  const [viewing, setViewing] = useState<VoteResponseDto | null>(null);
  const [deleting, setDeleting] = useState<VoteResponseDto | null>(null);

  const columns: Column<VoteResponseDto>[] = [
    { header: "Question", cell: (v) => <span className="line-clamp-1 max-w-xs">{v.question}</span> },
    { header: "Type", cell: (v) => v.voteType },
    { header: "Status", cell: (v) => <StatusBadge value={v.status} /> },
    { header: "Options", cell: (v) => v.options.length },
    { header: "Ends", cell: (v) => formatDate(v.endDate) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Votes</h1>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search votes…"
        filters={[
          {
            key: "status",
            label: "Status",
            value: list.filters.status ?? "",
            options: STATUSES.map((s) => ({ value: s, label: s })),
            onChange: (v) => list.setFilter("status", v),
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(v) => v.id}
        loading={list.loading}
        error={list.error}
        actions={(v) => (
          <div className="flex justify-end gap-1">
            <button className="btn btn-xs btn-text" onClick={() => setViewing(v)}>
              View
            </button>
            {isSuperAdmin && (
              <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(v)}>
                Delete
              </button>
            )}
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && <VoteView vote={viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete vote"
        message={`Delete vote "${deleting?.question}"?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteVote(deleting.id);
          setDeleting(null);
          list.refetch();
        }}
      />
    </div>
  );
}

function VoteView({ vote, onClose }: { vote: VoteResponseDto; onClose: () => void }) {
  const [results, setResults] = useState<VoteResultsResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVoteResults(vote.id)
      .then((r) => !cancelled && setResults(r))
      .catch((err) => !cancelled && setError(err?.response?.data?.message ?? err?.message ?? "Failed to load results"));
    return () => {
      cancelled = true;
    };
  }, [vote.id]);

  const totalCount = results?.totalResponses ?? 0;

  return (
    <FormModal open title="Vote" onClose={onClose} readOnly size="lg">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2">
          <p className="text-xs text-base-content/50">Question</p>
          <p>{vote.question}</p>
        </div>
        <Info label="Type" value={vote.voteType} />
        <Info label="Status" value={vote.status} />
        <Info label="Creator" value={shortId(vote.creatorId)} />
        <Info label="Districts" value={String(vote.districtIds.length)} />
        <Info label="Start" value={formatDate(vote.startDate)} />
        <Info label="End" value={formatDate(vote.endDate)} />
      </div>
      <div>
        <h4 className="font-medium mb-2">Results {results && `(${totalCount} responses)`}</h4>
        {error && <p className="text-sm text-error">{error}</p>}
        <ul className="space-y-2">
          {vote.options.map((opt) => {
            const count = results?.results.find((r) => r.option === opt)?.count ?? 0;
            const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            return (
              <li key={opt}>
                <div className="flex justify-between text-sm mb-0.5">
                  <span>{opt}</span>
                  <span className="text-base-content/60">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-base-200">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </FormModal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-base-content/50">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}
