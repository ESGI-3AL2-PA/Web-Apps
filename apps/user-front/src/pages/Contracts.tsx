import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ContractResponseDto, ContractSignatureStatus } from "@repo/contracts";
import { disputeContract, getContracts, resendContract } from "../api-service/contracts.service";
import { getListingById } from "../api-service/listings.service";
import { getUserPublic } from "../api-service/users.service";
import { formatPrice } from "../lib/format";
import { useDialog } from "../components/dialog-context";

// react-pdf and its ~1 MB pdfjs worker live in a separate chunk, loaded only
// when a preview is actually opened.
const ContractPdf = lazy(() => import("./ContractPdf"));

const STATUS_CLASS: Record<ContractSignatureStatus, string> = {
  draft: "bg-base-200 text-base-content/80",
  pending: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  rejected: "bg-error/15 text-error",
};

// The counterparty is the party the current user is *not* — provider looks at the beneficiary and vice versa.
const counterpartyId = (c: ContractResponseDto, userId: string | undefined) =>
  c.providerId === userId ? c.beneficiaryId : c.providerId;

export default function Contracts() {
  const { t } = useTranslation();
  const { alert } = useDialog();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [contracts, setContracts] = useState<ContractResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [disputeFor, setDisputeFor] = useState<ContractResponseDto | null>(null);
  // Resolved context, keyed by id — populated lazily so a row can render before its labels arrive.
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});
  const [partyNames, setPartyNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getContracts();
      setContracts(res.data);
    } catch {
      setError(true);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Resolve listing titles + counterparty names once per distinct id (getUserPublic is itself cached).
  useEffect(() => {
    if (contracts.length === 0) return;
    let cancelled = false;

    const listingIds = [...new Set(contracts.map((c) => c.listingId))];
    for (const id of listingIds) {
      getListingById(id)
        .then((listing) => {
          if (!cancelled) setListingTitles((prev) => ({ ...prev, [id]: listing.title }));
        })
        .catch(() => {});
    }

    const userIds = [...new Set(contracts.map((c) => counterpartyId(c, currentUserId)))];
    for (const id of userIds) {
      getUserPublic(id)
        .then((u) => {
          if (!cancelled) setPartyNames((prev) => ({ ...prev, [id]: `${u.firstName} ${u.lastName}` }));
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [contracts, currentUserId]);

  const onResend = async (id: string) => {
    setBusyId(id);
    try {
      await resendContract(id);
    } catch {
      await alert({ message: t("contracts.resendError") });
    } finally {
      setBusyId(null);
    }
  };

  const onDispute = async (id: string, reason: string) => {
    setBusyId(id);
    try {
      const updated = await disputeContract(id, { reason });
      setContracts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setDisputeFor(null);
    } catch {
      await alert({ message: t("contracts.disputeError") });
    } finally {
      setBusyId(null);
    }
  };

  // A contract can be disputed by a party while it's pending or fully signed, and not already disputed.
  const canDispute = (c: ContractResponseDto) =>
    !c.disputed && (c.signatureStatus === "pending" || c.signatureStatus === "completed");

  if (loading) return <p className="text-base-content/60">{t("common.loading")}</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-extrabold text-base-content">{t("contracts.title")}</h1>

      {error ? (
        <div className="rounded-xl border border-error/20 bg-error/10 p-4">
          <p className="text-sm text-error">{t("contracts.loadError")}</p>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-error/30 px-3 py-1.5 text-sm font-medium text-error hover:bg-error/10"
          >
            {t("contracts.retry")}
          </button>
        </div>
      ) : contracts.length === 0 ? (
        <p className="text-base-content/60">{t("contracts.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => {
            const isProvider = c.providerId === currentUserId;
            const counterparty = partyNames[counterpartyId(c, currentUserId)];
            const listingTitle = listingTitles[c.listingId];
            return (
              <li key={c.id} className="rounded-xl border border-base-content/10 bg-base-100 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-base-content">
                      {listingTitle ?? t("contracts.number", { id: c.id.slice(0, 8) })}
                    </p>
                    <p className="truncate text-sm text-base-content/60">
                      {(isProvider
                        ? t("contracts.withBeneficiary", { name: counterparty ?? "…" })
                        : t("contracts.withProvider", { name: counterparty ?? "…" })) +
                        " · " +
                        formatPrice(c.price)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        isProvider ? "bg-info/15 text-info" : "bg-secondary/15 text-secondary"
                      }`}
                    >
                      {isProvider ? t("contracts.youProvide") : t("contracts.youReceive")}
                    </span>
                    {c.disputed && (
                      <span className="rounded-full bg-error/15 px-2.5 py-1 text-xs font-medium text-error">
                        {t("contracts.disputed")}
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[c.signatureStatus]}`}>
                      {t(`contracts.status.${c.signatureStatus}`)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Signing happens on Documenso; the api hands us the caller's signing URL. */}
                  {c.signingUrl && (
                    <a
                      href={c.signingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-content hover:bg-primary/90"
                    >
                      {t("contracts.sign")}
                    </a>
                  )}
                  {c.signingUrl && (
                    <button
                      onClick={() => onResend(c.id)}
                      disabled={busyId === c.id}
                      className="rounded-lg border border-base-content/20 px-3 py-1.5 text-sm font-medium text-base-content/80 hover:bg-base-200 disabled:opacity-60"
                    >
                      {busyId === c.id ? t("contracts.resending") : t("contracts.resend")}
                    </button>
                  )}
                  {c.signatureStatus === "completed" && (
                    <button
                      onClick={() => setPreviewId(previewId === c.id ? null : c.id)}
                      className="rounded-lg border border-base-content/20 px-3 py-1.5 text-sm font-medium text-base-content/80 hover:bg-base-200"
                    >
                      {previewId === c.id ? t("contracts.hidePdf") : t("contracts.viewPdf")}
                    </button>
                  )}
                  {canDispute(c) && (
                    <button
                      onClick={() => setDisputeFor(c)}
                      disabled={busyId === c.id}
                      className="rounded-lg border border-error/30 px-3 py-1.5 text-sm font-medium text-error hover:bg-error/10 disabled:opacity-60"
                    >
                      {t("contracts.dispute")}
                    </button>
                  )}
                </div>

                {previewId === c.id && (
                  <Suspense fallback={<p className="mt-3 text-sm text-base-content/60">{t("contracts.pdfLoading")}</p>}>
                    <ContractPdf id={c.id} />
                  </Suspense>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {disputeFor && (
        <DisputeModal
          contract={disputeFor}
          busy={busyId === disputeFor.id}
          onClose={() => setDisputeFor(null)}
          onSubmit={(reason) => onDispute(disputeFor.id, reason)}
        />
      )}
    </div>
  );
}

// Local modal to capture a dispute reason — useDialog has no text-input primitive.
function DisputeModal({
  contract,
  busy,
  onClose,
  onSubmit,
}: {
  contract: ContractResponseDto;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t("contracts.disputeReasonRequired"));
      return;
    }
    setError(null);
    onSubmit(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label={t("common.cancel")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm rounded-t-2xl bg-base-100 p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-base-content">
            {t("contracts.dispute")} · {t("contracts.number", { id: contract.id.slice(0, 8) })}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="text-2xl leading-none text-base-content/60 hover:text-base-content"
          >
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="dispute-reason" className="mb-1.5 block text-sm text-base-content/70">
            {t("contracts.disputeReason")}
          </label>
          <textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            autoFocus
            className="w-full rounded-lg border border-base-content/20 bg-base-100 p-2.5 text-sm text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-base-content/20 px-4 py-2 text-sm font-semibold text-base-content/80 hover:bg-base-200"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-error-content hover:bg-error/90 disabled:opacity-60"
            >
              {busy ? t("contracts.resending") : t("contracts.disputeSubmit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
