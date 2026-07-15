import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ListingResponseDto, ListingStatus, ListingType } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { deleteListing, listListings } from "../../api-service/listings";
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
import { formatDate, formatTokens } from "../../lib/format";

const TYPES: ListingType[] = ["offer", "request"];
const STATUSES: ListingStatus[] = ["active", "closed", "expired"];

export default function ListingsList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";
  const list = useScopedList<ListingResponseDto>(listListings);
  const scope = useDistrictScope();
  const toast = useToast();
  const del = useAsyncAction();
  const [viewing, setViewing] = useState<ListingResponseDto | null>(null);
  const [deleting, setDeleting] = useState<ListingResponseDto | null>(null);

  const columns: Column<ListingResponseDto>[] = [
    { header: t("listings.col.title"), cell: (l) => l.title },
    { header: t("listings.col.type"), cell: (l) => <StatusBadge value={l.type} /> },
    { header: t("listings.col.status"), cell: (l) => <StatusBadge value={l.status} /> },
    { header: t("listings.col.price"), cell: (l) => formatTokens(l.price) },
    { header: t("listings.col.author"), cell: (l) => <UserName id={l.authorId} /> },
    { header: t("listings.col.created"), cell: (l) => formatDate(l.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{t("listings.title")}</h1>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder={t("listings.searchPlaceholder")}
        filters={[
          {
            key: "type",
            label: t("listings.typeFilter"),
            value: list.filters.type ?? "",
            options: TYPES.map((type) => ({ value: type, label: type })),
            onChange: (v) => list.setFilter("type", v),
          },
          {
            key: "status",
            label: t("listings.statusFilter"),
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
              {t("listings.view")}
            </button>
            {isSuperAdmin && (
              <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(l)}>
                {t("listings.delete")}
              </button>
            )}
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && (
        <FormModal open title={viewing.title} onClose={() => setViewing(null)} readOnly size="lg">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label={t("listings.info.type")} value={viewing.type} />
            <Info label={t("listings.info.status")} value={viewing.status} />
            <Info label={t("listings.info.price")} value={formatTokens(viewing.price)} />
            <Info label={t("listings.info.author")} value={<UserName id={viewing.authorId} />} />
            <Info label={t("listings.info.district")} value={scope.districtName ?? viewing.districtId} />
            <Info label={t("listings.info.tags")} value={viewing.tags?.join(", ") || "—"} />
            <Info label={t("listings.info.created")} value={formatDate(viewing.createdAt)} />
            <Info label={t("listings.info.expires")} value={formatDate(viewing.expiresAt)} />
          </div>
          <div>
            <p className="text-xs text-base-content/50">{t("listings.info.description")}</p>
            <p className="text-sm whitespace-pre-wrap">{viewing.description}</p>
          </div>
        </FormModal>
      )}
      <ConfirmDialog
        open={!!deleting}
        title={t("listings.deleteTitle")}
        message={t("listings.deleteMessage", { title: deleting?.title })}
        busy={del.busy}
        error={del.error}
        onCancel={() => {
          setDeleting(null);
          del.reset();
        }}
        onConfirm={() =>
          del.run(async () => {
            await deleteListing(deleting!.id);
            toast.show(t("listings.deleted"));
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
