import { useState } from "react";
import { useAuth } from "@repo/hooks";
import type { ListingResponseDto, ListingStatus, ListingType } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { deleteListing, listListings } from "../../api-service/listings";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { ShortId } from "../../components/ShortId";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useDistrictScope } from "../../app/DistrictScopeProvider";
import { formatDate, formatTokens } from "../../lib/format";

const TYPES: ListingType[] = ["offer", "request"];
const STATUSES: ListingStatus[] = ["active", "closed", "expired"];

export default function ListingsList() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";
  const list = useScopedList<ListingResponseDto>(listListings);
  const scope = useDistrictScope();
  const toast = useToast();
  const del = useAsyncAction();
  const [viewing, setViewing] = useState<ListingResponseDto | null>(null);
  const [deleting, setDeleting] = useState<ListingResponseDto | null>(null);

  const columns: Column<ListingResponseDto>[] = [
    { header: "Title", cell: (l) => l.title },
    { header: "Type", cell: (l) => <StatusBadge value={l.type} /> },
    { header: "Status", cell: (l) => <StatusBadge value={l.status} /> },
    { header: "Price", cell: (l) => formatTokens(l.price) },
    { header: "Author", cell: (l) => <ShortId value={l.authorId} /> },
    { header: "Created", cell: (l) => formatDate(l.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Listings</h1>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search listings…"
        filters={[
          {
            key: "type",
            label: "Type",
            value: list.filters.type ?? "",
            options: TYPES.map((t) => ({ value: t, label: t })),
            onChange: (v) => list.setFilter("type", v),
          },
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
        rowKey={(l) => l.id}
        loading={list.loading}
        error={list.error}
        actions={(l) => (
          <div className="flex justify-end gap-1">
            <button className="btn btn-xs btn-text" onClick={() => setViewing(l)}>
              View
            </button>
            {isSuperAdmin && (
              <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(l)}>
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
            <Info label="Type" value={viewing.type} />
            <Info label="Status" value={viewing.status} />
            <Info label="Price" value={formatTokens(viewing.price)} />
            <Info label="Author" value={viewing.authorId} />
            <Info label="District" value={scope.districtName ?? viewing.districtId} />
            <Info label="Tags" value={viewing.tags.join(", ") || "—"} />
            <Info label="Created" value={formatDate(viewing.createdAt)} />
            <Info label="Expires" value={formatDate(viewing.expiresAt)} />
          </div>
          <div>
            <p className="text-xs text-base-content/50">Description</p>
            <p className="text-sm whitespace-pre-wrap">{viewing.description}</p>
          </div>
        </FormModal>
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete listing"
        message={`Delete listing "${deleting?.title}"?`}
        busy={del.busy}
        error={del.error}
        onCancel={() => {
          setDeleting(null);
          del.reset();
        }}
        onConfirm={() =>
          del.run(async () => {
            await deleteListing(deleting!.id);
            toast.show("Listing deleted");
            setDeleting(null);
            list.refetch();
          })
        }
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-base-content/50">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}
