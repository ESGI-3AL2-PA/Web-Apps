import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ContractResponseDto, OpenSignStatus } from "@repo/contracts";
import { disputeContract, getContracts } from "../../api-service/api";

const statusBadgeClass: Record<OpenSignStatus, string> = {
  draft: "badge-neutral",
  sent: "badge-info",
  partially_signed: "badge-info",
  signed: "badge-success",
  expired: "badge-warning",
  declined: "badge-error",
};

const Contrat = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<ContractResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [disputeFor, setDisputeFor] = useState<ContractResponseDto | null>(null);

  const fetchMine = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const [asProvider, asBeneficiary] = await Promise.all([
        getContracts({ providerId: user.id, limit: 100 }),
        getContracts({ beneficiaryId: user.id, limit: 100 }),
      ]);
      const merged = new Map<string, ContractResponseDto>();
      [...asProvider.data, ...asBeneficiary.data].forEach((c) => merged.set(c.id, c));
      setData([...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const onDisputed = (updated: ContractResponseDto) => {
    setData((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-36 w-full rounded-box" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-base-content/70">{t("contracts.loadError")}</p>
        <button className="btn btn-primary btn-sm" onClick={fetchMine}>
          {t("annonces.retry")}
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="text-4xl" aria-hidden="true">
          📄
        </span>
        <p className="text-base-content/70">{t("contracts.empty")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((c) => {
          const role = c.providerId === user?.id ? "provider" : "beneficiary";
          return (
            <article key={c.id} className="card border border-base-content/10 bg-base-100 shadow-sm">
              <div className="card-body gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="badge badge-outline">{t(`contracts.role.${role}`)}</span>
                  <span className="badge badge-primary shrink-0">{t("listing.points", { count: c.price })}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${statusBadgeClass[c.openSignStatus]}`}>
                    {t(`contracts.status.${c.openSignStatus}`)}
                  </span>
                  {c.disputed && <span className="badge badge-error">{t("contracts.disputedBadge")}</span>}
                </div>
                {!c.disputed && (
                  <button className="btn btn-ghost btn-sm w-fit text-error" onClick={() => setDisputeFor(c)}>
                    {t("contracts.dispute")}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {disputeFor && <DisputeModal contract={disputeFor} onClose={() => setDisputeFor(null)} onDisputed={onDisputed} />}
    </>
  );
};

type DisputeModalProps = {
  contract: ContractResponseDto;
  onClose: () => void;
  onDisputed: (updated: ContractResponseDto) => void;
};

const DisputeModal = ({ contract, onClose, onDisputed }: DisputeModalProps) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    try {
      const updated = await disputeContract(contract.id, reason.trim());
      onDisputed(updated);
      onClose();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-box bg-base-100 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-xl font-bold text-base-content">{t("contracts.dispute")}</h2>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("contracts.disputeReason")}</span>
            <textarea
              required
              rows={4}
              className="textarea textarea-bordered"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-error">{t("contracts.disputeError")}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
              {t("contracts.cancel")}
            </button>
            <button type="submit" className="btn btn-error" disabled={submitting}>
              {t("contracts.disputeSubmit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Contrat;
