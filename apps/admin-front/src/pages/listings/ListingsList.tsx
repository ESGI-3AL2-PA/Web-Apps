import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ListingResponseDto, ListingStatus } from "@repo/contracts";
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
    { header: t("common.fields.title"), cell: (l) => l.title },
    { header: t("common.fields.status"), cell: (l) => <StatusBadge value={l.status} /> },
    { header: t("common.fields.price"), cell: (l) => formatTokens(l.price) },
    { header: t("common.fields.author"), cell: (l) => <UserName id={l.authorId} /> },
    { header: t("common.fields.created"), cell: (l) => formatDate(l.createdAt) },
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
        rowKey={(l) => l.id}
        loading={list.loading}
        error={list.error}
        actions={(l) => (
          <div className="flex justify-end gap-1">
            <button className="btn btn-xs btn-text" onClick={() => setViewing(l)}>
              {t("common.actions.view")}
            </button>
            {isSuperAdmin && (
              <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(l)}>
                {t("common.actions.delete")}
              </button>
            )}
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && (
        <FormModal open title={viewing.title} onClose={() => setViewing(null)} readOnly size="lg">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label={t("common.fields.status")} value={t(`status.${viewing.status}`, viewing.status)} />
            <Info label={t("common.fields.price")} value={formatTokens(viewing.price)} />
            <Info label={t("common.fields.author")} value={<UserName id={viewing.authorId} />} />
            <Info label={t("common.fields.district")} value={scope.districtName ?? viewing.districtId} />
            <Info label={t("common.fields.tags")} value={viewing.tags?.join(", ") || "—"} />
            <Info label={t("common.fields.created")} value={formatDate(viewing.createdAt)} />
            <Info label={t("common.fields.expires")} value={formatDate(viewing.expiresAt)} />
          </div>
          <div>
            <p className="text-xs text-base-content/50">{t("common.fields.description")}</p>
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
