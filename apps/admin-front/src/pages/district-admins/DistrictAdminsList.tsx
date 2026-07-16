import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { DistrictAdminResponseDto } from "@repo/contracts";
import { useList } from "../../hooks/useList";
import { useDistrictScope } from "../../app/DistrictScopeProvider";
import { createDistrictAdmin, deleteDistrictAdmin, listDistrictAdmins } from "../../api-service/district-admins";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { UserName } from "../../components/UserName";
import { UserAutocomplete } from "../../components/UserAutocomplete";
import { Field } from "../../components/Field";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { formatDate } from "../../lib/format";

export default function DistrictAdminsList() {
  const { t } = useTranslation();
  const { districts } = useDistrictScope();
  const list = useList<DistrictAdminResponseDto>(listDistrictAdmins);
  const toast = useToast();
  const grant = useAsyncAction();
  const revoke = useAsyncAction();
  const [districtId, setDistrictId] = useState("");
  const [userId, setUserId] = useState("");
  const [revoking, setRevoking] = useState<DistrictAdminResponseDto | null>(null);

  const districtName = (id: string) => districts.find((d) => d.id === id)?.name ?? id;

  const onGrant = (e: FormEvent) => {
    e.preventDefault();
    if (!districtId || !userId) return;
    grant.run(async () => {
      await createDistrictAdmin({ districtId, userId });
      toast.show(t("districtAdmins.granted"));
      setUserId("");
      list.refetch();
    });
  };

  const columns: Column<DistrictAdminResponseDto>[] = [
    { header: t("districtAdmins.district"), cell: (a) => districtName(a.districtId) },
    { header: t("districtAdmins.user"), cell: (a) => <UserName id={a.userId} /> },
    { header: t("common.fields.created"), cell: (a) => formatDate(a.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("districtAdmins.title")}</h1>
        <p className="text-sm text-base-content/60">{t("districtAdmins.subtitle")}</p>
      </div>

      <form
        onSubmit={onGrant}
        className="grid grid-cols-1 gap-3 rounded-box border border-base-content/10 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field label={t("districtAdmins.district")}>
          <select className="select" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">{t("districtAdmins.chooseDistrict")}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("districtAdmins.user")} hint={t("districtAdmins.userHint")}>
          <UserAutocomplete value={userId} onChange={setUserId} />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={!districtId || !userId || grant.busy}>
          {grant.busy ? t("districtAdmins.granting") : t("districtAdmins.grant")}
        </button>
        {grant.error && (
          <p role="alert" className="text-sm text-error sm:col-span-3">
            {grant.error}
          </p>
        )}
      </form>

      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(a) => a.id}
        loading={list.loading}
        error={list.error}
        emptyLabel={t("districtAdmins.empty")}
        actions={(a) => (
          <div className="flex justify-end gap-1">
            <button className="btn btn-xs btn-text btn-error" onClick={() => setRevoking(a)}>
              {t("districtAdmins.revoke")}
            </button>
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      <ConfirmDialog
        open={!!revoking}
        title={t("districtAdmins.revokeTitle")}
        message={t("districtAdmins.revokeMessage", { district: revoking ? districtName(revoking.districtId) : "" })}
        busy={revoke.busy}
        error={revoke.error}
        onCancel={() => {
          setRevoking(null);
          revoke.reset();
        }}
        onConfirm={() =>
          revoke.run(async () => {
            await deleteDistrictAdmin(revoking!.id);
            toast.show(t("districtAdmins.revoked"));
            setRevoking(null);
            list.refetch();
          })
        }
      />
    </div>
  );
}
