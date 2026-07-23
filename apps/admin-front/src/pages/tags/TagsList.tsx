// Page de gestion des tags (référentiel global, non scopé par quartier) : liste recherchable,
// création et édition en modale (clé technique + libellés/descriptions bilingues fr/en),
// suppression avec confirmation.
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CreateTagDto, TagResponseDto, UpdateTagDto } from "@repo/contracts";
import { useList } from "../../hooks/useList";
import { createTag, deleteTag, listTags, updateTag } from "../../api-service/tags";
import { DataTable, type Column } from "../../components/DataTable";
import { RowActionButton } from "../../components/RowActionButton";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field } from "../../components/Field";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";

export default function TagsList() {
  // `t` de i18next est aliasé en `tr` : dans les cellules du tableau, `t` désigne le tag de la ligne.
  const { t: tr } = useTranslation();
  const list = useList<TagResponseDto>(listTags);
  const toast = useToast();
  const del = useAsyncAction();
  const [editing, setEditing] = useState<TagResponseDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<TagResponseDto | null>(null);

  const columns: Column<TagResponseDto>[] = [
    { header: tr("tags.key"), cell: (t) => <span className="font-mono text-xs">{t.name}</span> },
    { header: tr("tags.labelFr"), cell: (t) => t.label?.fr ?? "—" },
    { header: tr("tags.labelEn"), cell: (t) => t.label?.en ?? "—" },
    { header: tr("tags.descriptionFr"), cell: (t) => t.description?.fr ?? "—" },
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
            <RowActionButton
              icon="icon-[tabler--pencil]"
              label={tr("common.actions.edit")}
              onClick={() => setEditing(t)}
            />
            <RowActionButton
              icon="icon-[tabler--trash]"
              label={tr("common.actions.delete")}
              variant="btn-error"
              onClick={() => setDeleting(t)}
            />
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

/**
 * Modale de création/édition d'un tag (création si `tag` est null, sinon édition).
 * @param onSaved appelé après enregistrement, avec `created` = true si c'était une création.
 */
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
  const [labelFr, setLabelFr] = useState(tag?.label?.fr ?? "");
  const [labelEn, setLabelEn] = useState(tag?.label?.en ?? "");
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
      // N'émet la description que si au moins une langue est renseignée ; elle reste optionnelle.
      const description = descFr || descEn ? { fr: descFr || undefined, en: descEn || undefined } : undefined;
      if (tag) {
        // `name` est la clé stable — immuable en édition, donc non envoyée.
        const body: UpdateTagDto = { label, description };
        await updateTag(tag.id, body);
      } else {
        const body: CreateTagDto = { name, label, description };
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
      <Field label={tr("tags.key")} required>
        <input
          className="input font-mono"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!!tag}
          placeholder={tr("tags.keyPlaceholder")}
          required
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={tr("tags.labelFr")} required>
          <input className="input" value={labelFr} onChange={(e) => setLabelFr(e.target.value)} required />
        </Field>
        <Field label={tr("tags.labelEn")} required>
          <input className="input" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} required />
        </Field>
        <Field label={tr("tags.descriptionFr")}>
          <textarea className="textarea" rows={3} value={descFr} onChange={(e) => setDescFr(e.target.value)} />
        </Field>
        <Field label={tr("tags.descriptionEn")}>
          <textarea className="textarea" rows={3} value={descEn} onChange={(e) => setDescEn(e.target.value)} />
        </Field>
      </div>
    </FormModal>
  );
}
