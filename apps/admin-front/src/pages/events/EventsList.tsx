// Page de gestion des événements du quartier actif : liste filtrable/paginée avec consultation,
// création, édition et suppression via modales. La création requiert un quartier en scope.
import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { CreateEventDto, EventResponseDto, EventStatus, UpdateEventDto } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { createEvent, deleteEvent, listEvents, updateEvent } from "../../api-service/events";
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

const STATUSES: EventStatus[] = ["upcoming", "ongoing", "completed", "cancelled"];

export default function EventsList() {
  const { t } = useTranslation();
  const list = useScopedList<EventResponseDto>(listEvents);
  const scope = useDistrictScope();
  const toast = useToast();
  const del = useAsyncAction();
  const [viewing, setViewing] = useState<EventResponseDto | null>(null);
  const [deleting, setDeleting] = useState<EventResponseDto | null>(null);
  const [editing, setEditing] = useState<EventResponseDto | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<EventResponseDto>[] = [
    { header: t("common.fields.title"), cell: (e) => e.title },
    { header: t("common.fields.status"), cell: (e) => <StatusBadge value={e.status} /> },
    { header: t("common.fields.location"), cell: (e) => e.location },
    { header: t("common.fields.seats"), cell: (e) => `${e.remainingSeats}/${e.totalSeats}` },
    { header: t("common.fields.date"), cell: (e) => formatDate(e.eventDate) },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("events.title")}</h1>
        <button
          className="btn btn-sm btn-primary"
          disabled={!scope.districtId}
          title={scope.districtId ? undefined : t("nav.noDistrict")}
          onClick={() => setCreating(true)}
        >
          {t("events.create")}
        </button>
      </div>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder={t("events.searchPlaceholder")}
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
        rowKey={(e) => e.id}
        loading={list.loading}
        error={list.error}
        actions={(e) => (
          <div className="flex justify-end gap-1">
            <RowActionButton icon="icon-[tabler--eye]" label={t("common.actions.view")} onClick={() => setViewing(e)} />
            <RowActionButton
              icon="icon-[tabler--pencil]"
              label={t("common.actions.edit")}
              onClick={() => setEditing(e)}
            />
            <RowActionButton
              icon="icon-[tabler--trash]"
              label={t("common.actions.delete")}
              variant="btn-error"
              onClick={() => setDeleting(e)}
            />
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && (
        <FormModal open title={viewing.title} onClose={() => setViewing(null)} readOnly size="lg">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label={t("common.fields.status")} value={t(`status.${viewing.status}`, viewing.status)} />
            <Info label={t("common.fields.location")} value={viewing.location} />
            <Info label={t("common.fields.creator")} value={<UserName id={viewing.creatorId} />} />
            <Info label={t("common.fields.district")} value={scope.districtName ?? viewing.districtId} />
            <Info label={t("common.fields.seats")} value={`${viewing.remainingSeats} / ${viewing.totalSeats}`} />
            <Info label={t("events.registrants")} value={String(viewing.registrants.length)} />
            <Info label={t("events.eventDate")} value={formatDate(viewing.eventDate)} />
            <Info label={t("common.fields.created")} value={formatDate(viewing.createdAt)} />
          </div>
          <div>
            <p className="text-xs text-base-content/50">{t("common.fields.description")}</p>
            <p className="text-sm whitespace-pre-wrap">{viewing.description}</p>
          </div>
        </FormModal>
      )}
      {creating && scope.districtId && (
        <EventForm
          districtId={scope.districtId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            toast.show(t("events.created"));
            list.refetch();
          }}
        />
      )}
      {editing && (
        <EventForm
          event={editing}
          districtId={editing.districtId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show(t("events.updated"));
            list.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={t("events.deleteTitle")}
        message={t("events.deleteMessage", { title: deleting?.title })}
        busy={del.busy}
        error={del.error}
        onCancel={() => {
          setDeleting(null);
          del.reset();
        }}
        onConfirm={() =>
          del.run(async () => {
            await deleteEvent(deleting!.id);
            toast.show(t("events.deleted"));
            setDeleting(null);
            list.refetch();
          })
        }
      />
    </div>
  );
}

/** Paire libellé/valeur en lecture seule dans la fiche de consultation. */
function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-base-content/50">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}

// Conversion datetime-local <-> ISO. L'input parle en local "YYYY-MM-DDTHH:mm" ; l'API parle en ISO.
// On soustrait le décalage horaire avant de tronquer pour préserver l'heure locale affichée.
const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
};

/**
 * Formulaire de création/édition d'un événement (mode déduit de la présence de `event`).
 * @param districtId quartier auquel rattacher l'événement à la création.
 * @param onSaved appelé après un enregistrement réussi.
 */
function EventForm({
  event,
  districtId,
  onClose,
  onSaved,
}: {
  event?: EventResponseDto;
  districtId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [totalSeats, setTotalSeats] = useState(String(event?.totalSeats ?? 20));
  const [eventDate, setEventDate] = useState(event ? toLocalInput(event.eventDate) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Reconvertit la saisie datetime-local (locale) en ISO attendu par l'API.
      const iso = new Date(eventDate).toISOString();
      if (event) {
        const body: UpdateEventDto = {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          totalSeats: Number(totalSeats) || 1,
          eventDate: iso,
        };
        await updateEvent(event.id, body);
      } else {
        const body: CreateEventDto = {
          districtId,
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          totalSeats: Number(totalSeats) || 1,
          eventDate: iso,
        };
        await createEvent(body);
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
      title={event ? t("events.editTitle") : t("events.create")}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      size="lg"
    >
      <Field label={t("common.fields.title")}>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} />
      </Field>
      <Field label={t("common.fields.location")}>
        <input
          className="input"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          maxLength={500}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("events.eventDate")}>
          <input
            className="input"
            type="datetime-local"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </Field>
        <Field label={t("common.fields.seats")}>
          <input
            className="input"
            type="number"
            min={1}
            value={totalSeats}
            onChange={(e) => setTotalSeats(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label={t("common.fields.description")}>
        <textarea
          className="textarea"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </Field>
    </FormModal>
  );
}
