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

export default function TagsList() {
  const list = useList<TagResponseDto>(listTags);
  const [editing, setEditing] = useState<TagResponseDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<TagResponseDto | null>(null);

  const columns: Column<TagResponseDto>[] = [
    { header: "Name", cell: (t) => t.name },
    { header: "Description", cell: (t) => t.description ?? "—" },
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
          onSaved={() => {
            setEditing(null);
            list.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete tag"
        message={`Delete tag "${deleting?.name}"?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteTag(deleting.id);
          setDeleting(null);
          list.refetch();
        }}
      />
    </div>
  );
}

function TagEdit({ tag, onClose, onSaved }: { tag: TagResponseDto | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tag?.name ?? "");
  const [description, setDescription] = useState(tag?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (tag) {
        const body: UpdateTagDto = { name, description: description || undefined };
        await updateTag(tag.id, body);
      } else {
        const body: CreateTagDto = { name, description: description || undefined };
        await createTag(body);
      }
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
      title={tag ? `Edit ${tag.name}` : "New tag"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    >
      <Field label="Name" required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Description">
        <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
    </FormModal>
  );
}
