import { useState, type FormEvent } from "react";
import type { CreateNotificationDto, NotificationResponseDto, NotificationType } from "@repo/contracts";
import { useList } from "../../hooks/useList";
import { createNotification, deleteNotification, listNotifications } from "../../api-service/notifications";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field } from "../../components/Field";
import { formatDate, shortId } from "../../lib/format";

const TYPES: NotificationType[] = ["listing", "contract", "event", "message", "vote", "incident", "system"];

export default function NotificationsList() {
  const list = useList<NotificationResponseDto>(listNotifications);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<NotificationResponseDto | null>(null);

  const columns: Column<NotificationResponseDto>[] = [
    { header: "Recipient", cell: (n) => shortId(n.recipientId) },
    { header: "Type", cell: (n) => <StatusBadge value={n.type} /> },
    { header: "Title", cell: (n) => n.title },
    { header: "Message", cell: (n) => <span className="line-clamp-1 max-w-xs">{n.message}</span> },
    { header: "Read", cell: (n) => (n.read ? "✓" : "—") },
    { header: "Date", cell: (n) => formatDate(n.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <Toolbar
        filters={[
          {
            key: "type",
            label: "Type",
            value: list.filters.type ?? "",
            options: TYPES.map((t) => ({ value: t, label: t })),
            onChange: (v) => list.setFilter("type", v),
          },
        ]}
        actions={
          <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
            <span className="icon-[tabler--send] size-4" /> Send notification
          </button>
        }
      />
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(n) => n.id}
        loading={list.loading}
        error={list.error}
        actions={(n) => (
          <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(n)}>
            Delete
          </button>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {creating && (
        <NotificationCreate
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            list.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete notification"
        message={`Delete notification "${deleting?.title}"?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteNotification(deleting.id);
          setDeleting(null);
          list.refetch();
        }}
      />
    </div>
  );
}

function NotificationCreate({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    recipientId: "",
    type: "system" as NotificationType,
    title: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body: CreateNotificationDto = {
      recipientId: form.recipientId,
      type: form.type,
      title: form.title,
      message: form.message,
    };
    try {
      await createNotification(body);
      onSaved();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2?.response?.data?.message ?? e2?.message ?? "Failed to send");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open
      title="Send notification"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel="Send"
    >
      <Field label="Recipient (user ID)" required>
        <input
          className="input"
          value={form.recipientId}
          onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
          required
        />
      </Field>
      <Field label="Type">
        <select
          className="select"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as NotificationType })}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title" required>
        <input
          className="input"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </Field>
      <Field label="Message" required>
        <textarea
          className="textarea"
          rows={3}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
        />
      </Field>
    </FormModal>
  );
}
