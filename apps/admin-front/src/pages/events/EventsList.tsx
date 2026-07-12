import { useState, type ReactNode } from "react";
import { useAuth } from "@repo/hooks";
import type { EventResponseDto, EventStatus } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { deleteEvent, listEvents } from "../../api-service/events";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { UserName } from "../../components/UserName";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useDistrictScope } from "../../app/DistrictScopeProvider";
import { formatDate } from "../../lib/format";

const STATUSES: EventStatus[] = ["upcoming", "ongoing", "completed", "cancelled"];

export default function EventsList() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";
  const list = useScopedList<EventResponseDto>(listEvents);
  const scope = useDistrictScope();
  const toast = useToast();
  const del = useAsyncAction();
  const [viewing, setViewing] = useState<EventResponseDto | null>(null);
  const [deleting, setDeleting] = useState<EventResponseDto | null>(null);

  const columns: Column<EventResponseDto>[] = [
    { header: "Title", cell: (e) => e.title },
    { header: "Status", cell: (e) => <StatusBadge value={e.status} /> },
    { header: "Location", cell: (e) => e.location },
    { header: "Seats", cell: (e) => `${e.remainingSeats}/${e.totalSeats}` },
    { header: "Date", cell: (e) => formatDate(e.eventDate) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Events</h1>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search events…"
        filters={[
          {
            key: "status",
            label: "Status",
            value: list.filters.status ?? "",
            options: STATUSES.map((s) => ({ value: s, label: s })),
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
            <button className="btn btn-xs btn-text" onClick={() => setViewing(e)}>
              View
            </button>
            {isSuperAdmin && (
              <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(e)}>
                Delete
              </button>
            )}
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && (
        <FormModal open title={viewing.title} onClose={() => setViewing(null)} readOnly size="lg">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Status" value={viewing.status} />
            <Info label="Location" value={viewing.location} />
            <Info label="Creator" value={<UserName id={viewing.creatorId} />} />
            <Info label="District" value={scope.districtName ?? viewing.districtId} />
            <Info label="Seats" value={`${viewing.remainingSeats} / ${viewing.totalSeats}`} />
            <Info label="Registrants" value={String(viewing.registrants.length)} />
            <Info label="Event date" value={formatDate(viewing.eventDate)} />
            <Info label="Created" value={formatDate(viewing.createdAt)} />
          </div>
          <div>
            <p className="text-xs text-base-content/50">Description</p>
            <p className="text-sm whitespace-pre-wrap">{viewing.description}</p>
          </div>
        </FormModal>
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete event"
        message={`Delete event "${deleting?.title}"?`}
        busy={del.busy}
        error={del.error}
        onCancel={() => {
          setDeleting(null);
          del.reset();
        }}
        onConfirm={() =>
          del.run(async () => {
            await deleteEvent(deleting!.id);
            toast.show("Event deleted");
            setDeleting(null);
            list.refetch();
          })
        }
      />
    </div>
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
