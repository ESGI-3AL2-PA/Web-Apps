import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
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
  const { t: tr } = useTranslation();
  const list = useList<TagResponseDto>(listTags);
  const toast = useToast();
  const del = useAsyncAction();
  const [editing, setEditing] = useState<TagResponseDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<TagResponseDto | null>(null);

  const columns: Column<TagResponseDto>[] = [
    { header: tr("common.fields.name"), cell: (t) => t.name },
    { header: tr("common.fields.description"), cell: (t) => t.description ?? "—" },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{tr("tags.title")}</h1>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder={tr("tags.searchPlaceholder")}
        actions={
          <button className="btn btn-sm btn-primary" onClick={() => setEditing("new")}>
            <span className="icon-[tabler--plus] size-4" /> {tr("tags.new")}
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
              {tr("common.actions.edit")}
            </button>
            <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(t)}>
              {tr("common.actions.delete")}
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
            toast.show(created ? tr("tags.created") : tr("tags.updated"));
            list.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={tr("tags.deleteTitle")}
        message={tr("tags.deleteMessage", { name: deleting?.name })}
        busy={del.busy}
        error={del.error}
        onCancel={() => {
          setDeleting(null);
          del.reset();
        }}
        onConfirm={() =>
          del.run(async () => {
            await deleteTag(deleting!.id);
            toast.show(tr("tags.deleted"));
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
  const { t: tr } = useTranslation();
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
      onSaved(!tag);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2?.response?.data?.message ?? e2?.message ?? tr("common.states.failedToSave"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open
      title={tag ? tr("tags.editTitle", { name: tag.name }) : tr("tags.new")}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    >
      <Field label={tr("common.fields.name")} required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label={tr("common.fields.description")}>
        <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
    </FormModal>
  );
}
