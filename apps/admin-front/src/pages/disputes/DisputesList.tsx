// Page de gestion des litiges : liste les contrats marqués « en litige » du quartier actif
// et permet à l'administrateur de trancher (libérer les points au prestataire ou rembourser
// le bénéficiaire) via une modale.
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ContractResponseDto, ResolveDisputeDto } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { listContracts, resolveDispute } from "../../api-service/contracts";
import { DataTable, type Column } from "../../components/DataTable";
import { RowActionButton } from "../../components/RowActionButton";
import { Pagination } from "../../components/Pagination";
import { StatusBadge } from "../../components/StatusBadge";
import { UserName } from "../../components/UserName";
import { FormModal } from "../../components/FormModal";
import { Field } from "../../components/Field";
import { useToast } from "../../components/Toast";
import { formatDate, formatTokens } from "../../lib/format";

export default function DisputesList() {
  const { t } = useTranslation();
  // Uniquement les contrats en litige ; le scope quartier est injecté par useScopedList et
  // appliqué côté serveur.
  const list = useScopedList<ContractResponseDto>(listContracts, { initialFilters: { disputed: "true" } });
  const toast = useToast();
  const [resolving, setResolving] = useState<ContractResponseDto | null>(null);

  const columns: Column<ContractResponseDto>[] = [
    { header: t("disputes.provider"), cell: (c) => <UserName id={c.providerId} /> },
    { header: t("disputes.beneficiary"), cell: (c) => <UserName id={c.beneficiaryId} /> },
    { header: t("common.fields.price"), cell: (c) => formatTokens(c.price) },
    { header: t("common.fields.status"), cell: (c) => <StatusBadge value={c.signatureStatus} /> },
    {
      header: t("disputes.reason"),
      cell: (c) => <span className="line-clamp-1 max-w-xs">{c.disputeReason ?? "—"}</span>,
    },
    { header: t("common.fields.created"), cell: (c) => formatDate(c.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{t("disputes.title")}</h1>
      <p className="text-sm text-base-content/60">{t("disputes.subtitle")}</p>
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(c) => c.id}
        loading={list.loading}
        error={list.error}
        emptyLabel={t("disputes.empty")}
        actions={(c) => (
          <div className="flex justify-end gap-1">
            <RowActionButton
              icon="icon-[tabler--gavel]"
              label={t("disputes.resolve")}
              variant="btn-primary"
              onClick={() => setResolving(c)}
            />
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {resolving && (
        <ResolveModal
          contract={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null);
            toast.show(t("disputes.resolved"));
            list.refetch();
          }}
        />
      )}
    </div>
  );
}

/**
 * Modale de résolution d'un litige : récapitule le contrat et laisse choisir l'issue
 * (« release » = libérer les points au prestataire, « refund » = rembourser le bénéficiaire).
 * @param onResolved appelé après un règlement réussi (ferme, notifie et rafraîchit la liste).
 */
function ResolveModal({
  contract,
  onClose,
  onResolved,
}: {
  contract: ContractResponseDto;
  onClose: () => void;
  onResolved: () => void;
}) {
  const { t } = useTranslation();
  const [resolution, setResolution] = useState<ResolveDisputeDto["resolution"]>("release");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await resolveDispute(contract.id, { resolution });
      onResolved();
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
      title={t("disputes.resolveTitle")}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-3 rounded-box bg-base-200/50 p-3 text-sm">
        <div>
          <p className="text-xs text-base-content/50">{t("disputes.provider")}</p>
          <p>
            <UserName id={contract.providerId} />
          </p>
        </div>
        <div>
          <p className="text-xs text-base-content/50">{t("disputes.beneficiary")}</p>
          <p>
            <UserName id={contract.beneficiaryId} />
          </p>
        </div>
        <div>
          <p className="text-xs text-base-content/50">{t("common.fields.price")}</p>
          <p>{formatTokens(contract.price)}</p>
        </div>
        <div>
          <p className="text-xs text-base-content/50">{t("common.fields.status")}</p>
          <p>
            <StatusBadge value={contract.signatureStatus} />
          </p>
        </div>
        {contract.disputeReason && (
          <div className="col-span-2">
            <p className="text-xs text-base-content/50">{t("disputes.reason")}</p>
            <p>{contract.disputeReason}</p>
          </div>
        )}
      </div>

      <Field label={t("disputes.resolution")} hint={t(`disputes.${resolution}Hint`)}>
        <select
          className="select"
          value={resolution}
          onChange={(e) => setResolution(e.target.value as ResolveDisputeDto["resolution"])}
        >
          <option value="release">{t("disputes.release")}</option>
          <option value="refund">{t("disputes.refund")}</option>
        </select>
      </Field>
    </FormModal>
  );
}
