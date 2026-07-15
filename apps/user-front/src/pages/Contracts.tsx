import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { ContractResponseDto, ContractSignatureStatus } from "@repo/contracts";
import { disputeContract, fetchContractPdf, getContracts, resendContract } from "../api-service/contracts.service";
import { formatPrice } from "../lib/format";
import { useDialog } from "../components/dialog-context";

// react-pdf needs its worker; resolve the bundled one through Vite.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const STATUS_CLASS: Record<ContractSignatureStatus, string> = {
  draft: "badge badge-neutral badge-soft",
  pending: "badge badge-warning badge-soft",
  completed: "badge badge-success badge-soft",
  rejected: "badge badge-error badge-soft",
};

export default function Contracts() {
  const { t } = useTranslation();
  const { alert } = useDialog();
  const [contracts, setContracts] = useState<ContractResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [disputeFor, setDisputeFor] = useState<ContractResponseDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getContracts();
      setContracts(res.data);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

      {contracts.length === 0 ? (
        <p className="text-base-content/60">{t("contracts.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => (
            <li key={c.id} className="rounded-box border border-base-content/10 bg-base-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-base-content">{t("contracts.number", { id: c.id.slice(0, 8) })}</p>
                  <p className="text-sm text-base-content/60">{formatPrice(c.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.disputed && <span className="badge badge-error badge-soft">{t("contracts.disputed")}</span>}
                  <span className={STATUS_CLASS[c.signatureStatus]}>{t(`contracts.status.${c.signatureStatus}`)}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {/* Signing happens on Documenso; the api hands us the caller's signing URL. */}
                {c.signingUrl && (
                  <a href={c.signingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                    {t("contracts.sign")}
                  </a>
                )}
                {c.signingUrl && (
                  <button onClick={() => onResend(c.id)} disabled={busyId === c.id} className="btn btn-soft btn-sm">
                    {busyId === c.id ? t("contracts.resending") : t("contracts.resend")}
                  </button>
                )}
                {c.signatureStatus === "completed" && (
                  <button
                    onClick={() => setPreviewId(previewId === c.id ? null : c.id)}
                    className="btn btn-soft btn-sm"
                  >
                    {previewId === c.id ? t("contracts.hidePdf") : t("contracts.viewPdf")}
                  </button>
                )}
                {canDispute(c) && (
                  <button
                    onClick={() => setDisputeFor(c)}
                    disabled={busyId === c.id}
                    className="btn btn-soft btn-error btn-sm"
                  >
                    {t("contracts.dispute")}
                  </button>
                )}
              </div>

              {previewId === c.id && <ContractPdf id={c.id} />}
            </li>
          ))}
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
          <button onClick={onClose} aria-label={t("common.cancel")} className="btn btn-text btn-circle btn-sm">
            <span className="icon-[tabler--x] size-5" />
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
            className="textarea w-full"
          />
          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-soft">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={busy} className="btn btn-error">
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

  if (failed) return <p className="mt-3 text-sm text-error">{t("contracts.pdfError")}</p>;
  if (!file) return <p className="mt-3 text-sm text-base-content/60">{t("contracts.pdfLoading")}</p>;

  return (
    <div className="mt-3 overflow-x-auto rounded-box border border-base-content/10">
      <Document file={file} onLoadSuccess={({ numPages }) => setPages(numPages)} loading={t("contracts.pdfLoading")}>
        {Array.from({ length: pages }, (_, i) => (
          <Page key={i} pageNumber={i + 1} width={640} />
        ))}
      </Document>
    </div>
  );
}
