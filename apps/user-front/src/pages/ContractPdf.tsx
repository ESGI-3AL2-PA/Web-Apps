import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { fetchContractPdf } from "../api-service/contracts.service";

// Page/composant : aperçu inline du PDF signé d'un contrat.
// react-pdf a besoin de son worker ; on résout celui empaqueté via Vite. Tout ce
// module (react-pdf + le worker pdfjs ~1 Mo) est chargé en lazy pour n'être livré
// que lorsqu'un utilisateur ouvre réellement l'aperçu PDF d'un contrat.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

/**
 * Récupère le PDF signé sous forme de Blob (via le proxy de l'api) et l'affiche inline.
 * @param id identifiant du contrat dont on veut l'aperçu.
 */
export default function ContractPdf({ id }: { id: string }) {
  const { t } = useTranslation();
  const [file, setFile] = useState<Blob | null>(null);
  const [pages, setPages] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Le garde `revoked` évite un setState après démontage (ou changement d'id).
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
