import { useState } from "react";
import { useAuth } from "@repo/hooks";
import type { ContractResponseDto, OpenSignStatus } from "@repo/contracts";
import { useList } from "../../hooks/useList";
import { deleteContract, listContracts } from "../../api-service/contracts";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatDate, shortId } from "../../lib/format";

const STATUSES: OpenSignStatus[] = ["draft", "sent", "partially_signed", "signed", "expired", "declined"];

export default function ContractsList() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";
  const list = useList<ContractResponseDto>(listContracts);
  const [viewing, setViewing] = useState<ContractResponseDto | null>(null);
  const [deleting, setDeleting] = useState<ContractResponseDto | null>(null);

  const columns: Column<ContractResponseDto>[] = [
    { header: "Listing", cell: (c) => shortId(c.listingId) },
    { header: "Provider", cell: (c) => shortId(c.providerId) },
    { header: "Beneficiary", cell: (c) => shortId(c.beneficiaryId) },
    { header: "Price", cell: (c) => c.price },
    { header: "Sign status", cell: (c) => <StatusBadge value={c.openSignStatus} /> },
    {
      header: "Disputed",
      cell: (c) => (c.disputed ? <span className="badge badge-sm badge-error">disputed</span> : "—"),
    },
    { header: "Created", cell: (c) => formatDate(c.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Contracts</h1>
      <Toolbar
        filters={[
          {
            key: "openSignStatus",
            label: "Sign status",
            value: list.filters.openSignStatus ?? "",
            options: STATUSES.map((s) => ({ value: s, label: s })),
            onChange: (v) => list.setFilter("openSignStatus", v),
          },
          {
            key: "disputed",
            label: "Disputed",
            value: list.filters.disputed ?? "",
            options: [
              { value: "true", label: "yes" },
              { value: "false", label: "no" },
            ],
            onChange: (v) => list.setFilter("disputed", v),
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(c) => c.id}
        loading={list.loading}
        error={list.error}
        actions={(c) => (
          <div className="flex justify-end gap-1">
            <button className="btn btn-xs btn-text" onClick={() => setViewing(c)}>
              View
            </button>
            {isSuperAdmin && (
              <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(c)}>
                Delete
              </button>
            )}
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && (
        <FormModal open title="Contract" onClose={() => setViewing(null)} readOnly size="lg">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Listing" value={viewing.listingId} />
            <Info label="Price" value={String(viewing.price)} />
            <Info label="Provider" value={viewing.providerId} />
            <Info label="Beneficiary" value={viewing.beneficiaryId} />
            <Info label="Sign status" value={viewing.openSignStatus} />
            <Info label="Disputed" value={viewing.disputed ? "yes" : "no"} />
            <Info label="OpenSign doc" value={viewing.openSignDocumentId} />
            <Info label="Created" value={formatDate(viewing.createdAt)} />
          </div>
        </FormModal>
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete contract"
        message={`Delete contract ${deleting ? shortId(deleting.id) : ""}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteContract(deleting.id);
          setDeleting(null);
          list.refetch();
        }}
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
