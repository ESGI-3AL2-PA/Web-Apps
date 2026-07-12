import { useEffect, useState, type FormEvent } from "react";
import type { IncidentResponseDto, IncidentStatus, UpdateIncidentDto } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { deleteIncident, listIncidents, updateIncident } from "../../api-service/incidents";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { UserName } from "../../components/UserName";
import { UserAutocomplete } from "../../components/UserAutocomplete";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field } from "../../components/Field";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { formatDate } from "../../lib/format";

const STATUSES: IncidentStatus[] = ["open", "in_progress", "resolved", "closed"];

export default function IncidentsList() {
  const list = useScopedList<IncidentResponseDto>(listIncidents);
  const toast = useToast();
  const del = useAsyncAction();
  const [editing, setEditing] = useState<IncidentResponseDto | null>(null);
  const [deleting, setDeleting] = useState<IncidentResponseDto | null>(null);

  // Every row is in the active district (the console is district-scoped), so no district column.
  const columns: Column<IncidentResponseDto>[] = [
    { header: "Category", cell: (i) => i.category },
    { header: "Description", cell: (i) => <span className="line-clamp-1 max-w-xs">{i.description}</span> },
    { header: "Status", cell: (i) => <StatusBadge value={i.status} /> },
    { header: "Assigned", cell: (i) => <UserName id={i.assignedTo} /> },
    { header: "Created", cell: (i) => formatDate(i.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Incidents</h1>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search incidents…"
        filters={[
          {
            key: "status",
            label: "Status",
            value: list.filters.status ?? "",
            options: STATUSES.map((s) => ({ value: s, label: s })),
            onChange: (v) => list.setFilter("status", v),
          },
        ]}
        extraFilters={
          <CategoryFilter value={list.filters.category ?? ""} onChange={(v) => list.setFilter("category", v)} />
        }
      />
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(i) => i.id}
        loading={list.loading}
        error={list.error}
        actions={(i) => (
          <div className="flex justify-end gap-1">
            <button className="btn btn-xs btn-text" onClick={() => setEditing(i)}>
              Manage
            </button>
            <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(i)}>
              Delete
            </button>
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {editing && (
        <IncidentEdit
          incident={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show("Incident updated");
            list.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete incident"
        message={`Delete incident "${deleting?.category}"?`}
        busy={del.busy}
        error={del.error}
        onCancel={() => {
          setDeleting(null);
          del.reset();
        }}
        onConfirm={() =>
          del.run(async () => {
            await deleteIncident(deleting!.id);
            toast.show("Incident deleted");
            setDeleting(null);
            list.refetch();
          })
        }
      />
    </div>
  );
}

// Free-text category filter, debounced so it commits as you type without a request per keystroke.
function CategoryFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== value) onChange(text);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value` is the committed value; syncing on it would fight typing
  }, [text]);

  return (
    <label className="input input-sm max-w-[12rem]">
      <span className="icon-[tabler--filter] size-4 text-base-content/60" />
      <input
        value={text}
        placeholder="Category"
        aria-label="Filter by category"
        onChange={(e) => setText(e.target.value)}
      />
    </label>
  );
}

function IncidentEdit({
  incident,
  onClose,
  onSaved,
}: {
  incident: IncidentResponseDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [assignedTo, setAssignedTo] = useState(incident.assignedTo ?? "");
  const [historyNote, setHistoryNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body: UpdateIncidentDto = {
      status,
      assignedTo: assignedTo || undefined,
      historyNote: historyNote || undefined,
    };
    try {
      await updateIncident(incident.id, body);
      onSaved();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2?.response?.data?.message ?? e2?.message ?? "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open
      title="Manage incident"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-3 text-sm bg-base-200/50 rounded-box p-3">
        <div>
          <p className="text-xs text-base-content/50">Category</p>
          <p>{incident.category}</p>
        </div>
        <div>
          <p className="text-xs text-base-content/50">Reporter</p>
          <p>
            <UserName id={incident.reporterId} />
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-base-content/50">Description</p>
          <p>{incident.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assigned to">
          <UserAutocomplete value={assignedTo} onChange={setAssignedTo} />
        </Field>
      </div>
      <Field label="History note" hint="Appended to the timeline on save.">
        <textarea className="textarea" rows={2} value={historyNote} onChange={(e) => setHistoryNote(e.target.value)} />
      </Field>

      <div>
        <h4 className="font-medium mb-2">History</h4>
        <ol className="relative border-s border-base-content/15 ms-2 space-y-3">
          {incident.history.length === 0 && <p className="text-sm text-base-content/60 ms-4">No history yet</p>}
          {incident.history.map((h, idx) => (
            <li key={idx} className="ms-4">
              <span className="absolute -start-1.5 mt-1.5 size-3 rounded-full bg-primary" />
              <div className="flex items-center gap-2">
                <StatusBadge value={h.status} />
                <span className="text-xs text-base-content/60">{formatDate(h.updatedAt)}</span>
              </div>
              {h.note && <p className="text-sm mt-0.5">{h.note}</p>}
              <p className="text-xs text-base-content/50">
                by <UserName id={h.updatedBy} />
              </p>
            </li>
          ))}
        </ol>
      </div>
    </FormModal>
  );
}
