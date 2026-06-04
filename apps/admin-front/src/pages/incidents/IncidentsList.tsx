import { useState, type FormEvent } from "react";
import type { IncidentResponseDto, IncidentStatus, UpdateIncidentDto } from "@repo/contracts";
import { useList } from "../../hooks/useList";
import { deleteIncident, listIncidents, updateIncident } from "../../api-service/incidents";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field } from "../../components/Field";
import { formatDate, shortId } from "../../lib/format";

const STATUSES: IncidentStatus[] = ["open", "in_progress", "resolved", "closed"];

export default function IncidentsList() {
  const list = useList<IncidentResponseDto>(listIncidents);
  const [editing, setEditing] = useState<IncidentResponseDto | null>(null);
  const [deleting, setDeleting] = useState<IncidentResponseDto | null>(null);

  const columns: Column<IncidentResponseDto>[] = [
    { header: "Category", cell: (i) => i.category },
    { header: "Description", cell: (i) => <span className="line-clamp-1 max-w-xs">{i.description}</span> },
    { header: "District", cell: (i) => shortId(i.districtId) },
    { header: "Status", cell: (i) => <StatusBadge value={i.status} /> },
    { header: "Assigned", cell: (i) => (i.assignedTo ? shortId(i.assignedTo) : "—") },
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
        actions={
          <div className="flex gap-2">
            <input
              className="input input-sm max-w-[10rem]"
              placeholder="Category"
              defaultValue={list.filters.category ?? ""}
              onBlur={(e) => list.setFilter("category", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && list.setFilter("category", e.currentTarget.value)}
            />
            <input
              className="input input-sm max-w-[10rem]"
              placeholder="District ID"
              defaultValue={list.filters.districtId ?? ""}
              onBlur={(e) => list.setFilter("districtId", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && list.setFilter("districtId", e.currentTarget.value)}
            />
          </div>
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
            list.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete incident"
        message={`Delete incident "${deleting?.category}"?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteIncident(deleting.id);
          setDeleting(null);
          list.refetch();
        }}
      />
    </div>
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
          <p>{shortId(incident.reporterId)}</p>
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
        <Field label="Assigned to (user ID)">
          <input className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
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
              <p className="text-xs text-base-content/50">by {shortId(h.updatedBy)}</p>
            </li>
          ))}
        </ol>
      </div>
    </FormModal>
  );
}
