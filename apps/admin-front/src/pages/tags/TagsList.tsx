import { useState, type FormEvent } from "react";
import type { CreateTagDto, TagResponseDto, UpdateTagDto } from "@repo/contracts";
import { useList } from "../../hooks/useList";
import { createTag, deleteTag, listTags, updateTag } from "../../api-service/tags";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field } from "../../components/Field";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";

export default function TagsList() {
  const list = useList<TagResponseDto>(listTags);
  const toast = useToast();
  const del = useAsyncAction();
  const [editing, setEditing] = useState<TagResponseDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<TagResponseDto | null>(null);

  const columns: Column<TagResponseDto>[] = [
    { header: "Key", cell: (t) => <span className="font-mono text-xs">{t.name}</span> },
    { header: "Label (FR)", cell: (t) => t.label.fr },
    { header: "Label (EN)", cell: (t) => t.label.en },
    { header: "Description (FR)", cell: (t) => t.description?.fr ?? "—" },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Tags</h1>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search tags…"
        actions={
          <button className="btn btn-sm btn-primary" onClick={() => setEditing("new")}>
            <span className="icon-[tabler--plus] size-4" /> New tag
          </button>
        }
      />
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(t) => t.id}
        loading={list.loading}
        error={list.error}
        actions={(t) => (
          <div className="flex justify-end gap-1">
            <button className="btn btn-xs btn-text" onClick={() => setEditing(t)}>
              Edit
            </button>
            <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(t)}>
              Delete
            </button>
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {editing && (
        <TagEdit
          tag={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            toast.show(created ? "Tag created" : "Tag updated");
            list.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete tag"
        message={`Delete tag "${deleting?.name}"?`}
        busy={del.busy}
        error={del.error}
        onCancel={() => {
          setDeleting(null);
          del.reset();
        }}
        onConfirm={() =>
          del.run(async () => {
            await deleteTag(deleting!.id);
            toast.show("Tag deleted");
            setDeleting(null);
            list.refetch();
          })
        }
      />
    </div>
  );
}

function TagEdit({
  tag,
  onClose,
  onSaved,
}: {
  tag: TagResponseDto | null;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const [name, setName] = useState(tag?.name ?? "");
  const [labelFr, setLabelFr] = useState(tag?.label.fr ?? "");
  const [labelEn, setLabelEn] = useState(tag?.label.en ?? "");
  const [descFr, setDescFr] = useState(tag?.description?.fr ?? "");
  const [descEn, setDescEn] = useState(tag?.description?.en ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const label = { fr: labelFr, en: labelEn };
      // Only emit description when at least one language is filled; keep it optional.
      const description = descFr || descEn ? { fr: descFr || undefined, en: descEn || undefined } : undefined;
      if (tag) {
        // `name` is the stable key — immutable on edit, so it is not sent.
        const body: UpdateTagDto = { label, description };
        await updateTag(tag.id, body);
      } else {
        const body: CreateTagDto = { name, label, description };
        await createTag(body);
      }
      onSaved(!tag);
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
      title={tag ? `Edit ${tag.name}` : "New tag"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    >
      <Field label="Key" required>
        <input
          className="input font-mono"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!!tag}
          placeholder="plumbing"
          required
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Label (FR)" required>
          <input className="input" value={labelFr} onChange={(e) => setLabelFr(e.target.value)} required />
        </Field>
        <Field label="Label (EN)" required>
          <input className="input" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} required />
        </Field>
        <Field label="Description (FR)">
          <textarea className="textarea" rows={3} value={descFr} onChange={(e) => setDescFr(e.target.value)} />
        </Field>
        <Field label="Description (EN)">
          <textarea className="textarea" rows={3} value={descEn} onChange={(e) => setDescEn(e.target.value)} />
        </Field>
      </div>
    </FormModal>
  );
}
