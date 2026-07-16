import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { VoteResponseDto, VoteResultsResponseDto, VoteStatus } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { deleteVote, getVoteResults, listVotes } from "../../api-service/votes";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { UserName } from "../../components/UserName";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { formatDate } from "../../lib/format";

const STATUSES: VoteStatus[] = ["draft", "open", "closed"];

export default function VotesList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";
  const list = useScopedList<VoteResponseDto>(listVotes);
  const toast = useToast();
  const del = useAsyncAction();
  const [viewing, setViewing] = useState<VoteResponseDto | null>(null);
  const [deleting, setDeleting] = useState<VoteResponseDto | null>(null);

  const columns: Column<VoteResponseDto>[] = [
    { header: t("common.fields.question"), cell: (v) => <span className="line-clamp-1 max-w-xs">{v.question}</span> },
    { header: t("common.fields.type"), cell: (v) => v.voteType },
    { header: t("common.fields.status"), cell: (v) => <StatusBadge value={v.status} /> },
    { header: t("common.fields.options"), cell: (v) => v.options.length },
    { header: t("common.fields.ends"), cell: (v) => formatDate(v.endDate) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{t("votes.title")}</h1>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder={t("votes.searchPlaceholder")}
        filters={[
          {
            key: "status",
            label: t("common.fields.status"),
            value: list.filters.status ?? "",
            options: STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
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
              {t("common.actions.view")}
            </button>
            {isSuperAdmin && (
              <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(v)}>
                {t("common.actions.delete")}
              </button>
            )}
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && <VoteView vote={viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={t("votes.deleteTitle")}
        message={t("votes.deleteMessage", { question: deleting?.question })}
        busy={del.busy}
        error={del.error}
        onCancel={() => {
          setDeleting(null);
          del.reset();
        }}
        onConfirm={() =>
          del.run(async () => {
            await deleteVote(deleting!.id);
            toast.show(t("votes.deleted"));
            setDeleting(null);
            list.refetch();
          })
        }
      />
    </div>
  );
}

function VoteView({ vote, onClose }: { vote: VoteResponseDto; onClose: () => void }) {
  const { t } = useTranslation();
  const [results, setResults] = useState<VoteResultsResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVoteResults(vote.id)
      .then((r) => !cancelled && setResults(r))
      .catch(
        (err) => !cancelled && setError(err?.response?.data?.message ?? err?.message ?? t("votes.loadResultsFailed")),
      );
    return () => {
      cancelled = true;
    };
  }, [vote.id, t]);

  const totalCount = results?.totalResponses ?? 0;

  return (
    <FormModal open title={t("votes.viewTitle")} onClose={onClose} readOnly size="lg">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2">
          <p className="text-xs text-base-content/50">{t("common.fields.question")}</p>
          <p>{vote.question}</p>
        </div>
        <Info label={t("common.fields.type")} value={vote.voteType} />
        <Info label={t("common.fields.status")} value={t(`status.${vote.status}`, vote.status)} />
        <Info label={t("common.fields.creator")} value={<UserName id={vote.creatorId} />} />
        <Info label={t("common.fields.districts")} value={String(vote.districtIds.length)} />
        <Info label={t("votes.start")} value={formatDate(vote.startDate)} />
        <Info label={t("votes.end")} value={formatDate(vote.endDate)} />
      </div>
      <div>
        <h4 className="font-medium mb-2">
          {t("votes.results")} {results && t("votes.resultsCount", { count: totalCount })}
        </h4>
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

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-base-content/50">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}
