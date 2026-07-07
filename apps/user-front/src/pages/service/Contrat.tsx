import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { ContractResponseDto, ContractSignatureStatus } from "@repo/contracts";
import { getContracts, resendContract, fetchContractPdf } from "../../api-service/contracts.service";

// react-pdf needs its worker; resolve the bundled one through Vite.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const STATUS_LABEL: Record<ContractSignatureStatus, string> = {
  draft: "Brouillon",
  pending: "En attente de signature",
  completed: "Signé",
  rejected: "Refusé",
};

const STATUS_CLASS: Record<ContractSignatureStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const Contrat = () => {
  const [contracts, setContracts] = useState<ContractResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getContracts();
      setContracts(res.data);
      setError(null);
    } catch {
      setError("Impossible de charger vos contrats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleResend = async (id: string) => {
    setBusyId(id);
    try {
      await resendContract(id);
    } catch {
      setError("Le renvoi de l'invitation a échoué.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="p-6 text-gray-500">Chargement…</p>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Mes contrats</h1>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {contracts.length === 0 ? (
        <p className="text-gray-500">Vous n'avez aucun contrat pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => (
            <li key={c.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Contrat #{c.id.slice(0, 8)}</p>
                  <p className="text-sm text-gray-500">{c.price} jetons</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.disputed && (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">Litige</span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[c.signatureStatus]}`}>
                    {STATUS_LABEL[c.signatureStatus]}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {/* Signing happens on Documenso; the api hands us the caller's signing URL. */}
                {c.signingUrl && (
                  <a
                    href={c.signingUrl}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Signer
                  </a>
                )}
                {c.signingUrl && (
                  <button
                    onClick={() => handleResend(c.id)}
                    disabled={busyId === c.id}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {busyId === c.id ? "Envoi…" : "Renvoyer l'invitation"}
                  </button>
                )}
                {c.signatureStatus === "completed" && (
                  <button
                    onClick={() => setPreviewId(previewId === c.id ? null : c.id)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
                  >
                    {previewId === c.id ? "Masquer le PDF" : "Voir le contrat signé"}
                  </button>
                )}
              </div>

              {previewId === c.id && <ContractPdf id={c.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Fetches the signed PDF as a Blob (via the api proxy) and renders it inline.
const ContractPdf = ({ id }: { id: string }) => {
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

  if (failed) return <p className="mt-3 text-sm text-red-700">Impossible d'afficher le PDF.</p>;
  if (!file) return <p className="mt-3 text-sm text-gray-500">Chargement du PDF…</p>;

  return (
    <div className="mt-3 overflow-x-auto rounded border border-gray-200">
      <Document file={file} onLoadSuccess={({ numPages }) => setPages(numPages)} loading="Chargement du PDF…">
        {Array.from({ length: pages }, (_, i) => (
          <Page key={i} pageNumber={i + 1} width={640} />
        ))}
      </Document>
    </div>
  );
};

export default Contrat;
