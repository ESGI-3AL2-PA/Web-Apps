import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useAuth } from "@repo/hooks";
import type { ContractResponseDto, ContractSignatureStatus } from "@repo/contracts";
import { disputeContract, fetchContractPdf, getContracts, resendContract } from "../api-service/contracts.service";
import { getListingById } from "../api-service/listings.service";
import { getUserPublic } from "../api-service/users.service";
import { formatPrice } from "../lib/format";
import { useDialog } from "../components/dialog-context";

// react-pdf needs its worker; resolve the bundled one through Vite.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const STATUS_CLASS: Record<ContractSignatureStatus, string> = {
  draft: "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200",
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
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

  if (loading) return <p className="text-neutral-500 dark:text-neutral-400">{t("common.loading")}</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">{t("contracts.title")}</h1>

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{t("contracts.loadError")}</p>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950"
          >
            {t("contracts.retry")}
          </button>
        </div>
      ) : contracts.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400">{t("contracts.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => {
            const isProvider = c.providerId === currentUserId;
            const counterparty = partyNames[counterpartyId(c, currentUserId)];
            const listingTitle = listingTitles[c.listingId];
            return (
              <li
                key={c.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-900 dark:text-neutral-50">
                      {listingTitle ?? t("contracts.number", { id: c.id.slice(0, 8) })}
                    </p>
                    <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
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
                        isProvider ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {isProvider ? t("contracts.youProvide") : t("contracts.youReceive")}
                    </span>
                    {c.disputed && (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
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
                      className="rounded-lg bg-[color:var(--color-brand)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
                    >
                      {t("contracts.sign")}
                    </a>
                  )}
                  {c.signingUrl && (
                    <button
                      onClick={() => onResend(c.id)}
                      disabled={busyId === c.id}
                      className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60"
                    >
                      {busyId === c.id ? t("contracts.resending") : t("contracts.resend")}
                    </button>
                  )}
                  {c.signatureStatus === "completed" && (
                    <button
                      onClick={() => setPreviewId(previewId === c.id ? null : c.id)}
                      className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      {previewId === c.id ? t("contracts.hidePdf") : t("contracts.viewPdf")}
                    </button>
                  )}
                  {canDispute(c) && (
                    <button
                      onClick={() => setDisputeFor(c)}
                      disabled={busyId === c.id}
                      className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-60"
                    >
                      {t("contracts.dispute")}
                    </button>
                  )}
                </div>

                {previewId === c.id && <ContractPdf id={c.id} />}
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
      <div className="relative w-full max-w-sm rounded-t-2xl bg-white dark:bg-neutral-900 p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {t("contracts.dispute")} · {t("contracts.number", { id: contract.id.slice(0, 8) })}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="text-2xl leading-none text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="dispute-reason" className="mb-1.5 block text-sm text-neutral-600 dark:text-neutral-300">
            {t("contracts.disputeReason")}
          </label>
          <textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            autoFocus
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5 text-sm text-neutral-900 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? t("contracts.resending") : t("contracts.disputeSubmit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Fetches the signed PDF as a Blob (via the api proxy) and renders it inline.
function ContractPdf({ id }: { id: string }) {
  const { t } = useTranslation();
  const [file, setFile] = useState<Blob | null>(null);
  const [pages, setPages] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    fetchContractPdf(id)
      .then((blob) => {
        if (!revoked) setFile(blob);
      })
      .catch(() => setFailed(true));
    return () => {
      revoked = true;
    };
  }, [id]);

  if (failed) return <p className="mt-3 text-sm text-red-700">{t("contracts.pdfError")}</p>;
  if (!file) return <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{t("contracts.pdfLoading")}</p>;

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
      <Document file={file} onLoadSuccess={({ numPages }) => setPages(numPages)} loading={t("contracts.pdfLoading")}>
        {Array.from({ length: pages }, (_, i) => (
          <Page key={i} pageNumber={i + 1} width={640} />
        ))}
      </Document>
    </div>
  );
}
