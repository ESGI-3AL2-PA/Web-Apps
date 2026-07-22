import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  CreateVoteDto,
  UpdateVoteDto,
  VoteResponseDto,
  VoteResultsResponseDto,
  VoteStatus,
} from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { createVote, deleteVote, getVoteResults, listVotes, updateVote } from "../../api-service/votes";
import { DataTable, type Column } from "../../components/DataTable";
import { RowActionButton } from "../../components/RowActionButton";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { UserName } from "../../components/UserName";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field } from "../../components/Field";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useDistrictScope } from "../../app/DistrictScopeProvider";
import { formatDate } from "../../lib/format";

const STATUSES: VoteStatus[] = ["draft", "open", "closed"];
type VoteType = CreateVoteDto["voteType"];
const VOTE_TYPES: VoteType[] = ["single_choice", "multiple_choice"];

export default function VotesList() {
  const { t } = useTranslation();
  const list = useScopedList<VoteResponseDto>(listVotes);
  const scope = useDistrictScope();
  const toast = useToast();
  const del = useAsyncAction();
  const [viewing, setViewing] = useState<VoteResponseDto | null>(null);
  const [deleting, setDeleting] = useState<VoteResponseDto | null>(null);
  const [editing, setEditing] = useState<VoteResponseDto | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<VoteResponseDto>[] = [
    { header: t("common.fields.question"), cell: (v) => <span className="line-clamp-1 max-w-xs">{v.question}</span> },
    { header: t("common.fields.type"), cell: (v) => v.voteType },
    { header: t("common.fields.status"), cell: (v) => <StatusBadge value={v.status} /> },
    { header: t("common.fields.options"), cell: (v) => v.options.length },
    { header: t("common.fields.ends"), cell: (v) => formatDate(v.endDate) },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("votes.title")}</h1>
        <button
          className="btn btn-sm btn-primary"
          disabled={!scope.districtId}
          title={scope.districtId ? undefined : t("nav.noDistrict")}
          onClick={() => setCreating(true)}
        >
          {t("votes.create")}
        </button>
      </div>
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
            <RowActionButton icon="icon-[tabler--eye]" label={t("common.actions.view")} onClick={() => setViewing(v)} />
            <RowActionButton
              icon="icon-[tabler--pencil]"
              label={t("common.actions.edit")}
              onClick={() => setEditing(v)}
            />
            <RowActionButton
              icon="icon-[tabler--trash]"
              label={t("common.actions.delete")}
              variant="btn-error"
              onClick={() => setDeleting(v)}
            />
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && <VoteView vote={viewing} onClose={() => setViewing(null)} />}
      {creating && scope.districtId && (
        <VoteForm
          districtId={scope.districtId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            toast.show(t("votes.created"));
            list.refetch();
          }}
        />
      )}
      {editing && (
        <VoteForm
          vote={editing}
          districtId={editing.districtIds[0] ?? ""}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show(t("votes.updated"));
            list.refetch();
          }}
        />
      )}
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

// datetime-local <-> ISO: the input speaks local "YYYY-MM-DDTHH:mm", the API speaks ISO.
const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const nowLocal = (plusDays = 0): string => {
  const d = new Date(Date.now() + plusDays * 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function VoteForm({
  vote,
  districtId,
  onClose,
  onSaved,
}: {
  vote?: VoteResponseDto;
  districtId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState(vote?.question ?? "");
  const [options, setOptions] = useState<string[]>(vote?.options ?? ["", ""]);
  const [voteType, setVoteType] = useState<VoteType>(vote?.voteType ?? "single_choice");
  const [status, setStatus] = useState<VoteStatus>(vote?.status ?? "draft");
  const [startDate, setStartDate] = useState(vote ? toLocalInput(vote.startDate) : nowLocal());
  const [endDate, setEndDate] = useState(vote ? toLocalInput(vote.endDate) : nowLocal(7));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOption = (i: number, value: string) => setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError(t("votes.needTwoOptions"));
      setSubmitting(false);
      return;
    }
    try {
      const start = new Date(startDate).toISOString();
      const end = new Date(endDate).toISOString();
      if (vote) {
        const body: UpdateVoteDto = {
          question: question.trim(),
          options: cleanOptions,
          voteType,
          status,
          startDate: start,
          endDate: end,
        };
        await updateVote(vote.id, body);
      } else {
        const body: CreateVoteDto = {
          districtIds: [districtId],
          question: question.trim(),
          options: cleanOptions,
          voteType,
          startDate: start,
          endDate: end,
        };
        await createVote(body);
      }
      onSaved();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2?.response?.data?.message ?? e2?.message ?? t("common.states.failedToSave"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open
      title={vote ? t("votes.editTitle") : t("votes.create")}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      size="lg"
    >
      <Field label={t("common.fields.question")}>
        <textarea
          className="textarea"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          maxLength={500}
        />
      </Field>

      <div>
        <p className="mb-1 text-sm font-medium">{t("common.fields.options")}</p>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input flex-1"
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={t("votes.optionPlaceholder", { n: i + 1 })}
                aria-label={t("votes.optionPlaceholder", { n: i + 1 })}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="btn btn-square btn-text btn-error"
                  aria-label={t("common.actions.delete")}
                  onClick={() => removeOption(i)}
                >
                  <span className="icon-[tabler--x] size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm btn-text mt-2" onClick={addOption}>
          <span className="icon-[tabler--plus] size-4" />
          {t("votes.addOption")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.fields.type")}>
          <select className="select" value={voteType} onChange={(e) => setVoteType(e.target.value as VoteType)}>
            {VOTE_TYPES.map((vt) => (
              <option key={vt} value={vt}>
                {t(`voteType.${vt}`)}
              </option>
            ))}
          </select>
        </Field>
        {vote && (
          <Field label={t("common.fields.status")}>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as VoteStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("votes.start")}>
          <input
            className="input"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>
        <Field label={t("votes.end")}>
          <input
            className="input"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </Field>
      </div>
    </FormModal>
  );
}
