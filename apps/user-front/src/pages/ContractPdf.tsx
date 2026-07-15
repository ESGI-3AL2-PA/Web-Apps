import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { fetchContractPdf } from "../api-service/contracts.service";

// react-pdf needs its worker; resolve the bundled one through Vite. This whole
// module (react-pdf + the ~1 MB pdfjs worker) is lazy-loaded so it only ships
// when a user actually opens a contract PDF preview.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

// Fetches the signed PDF as a Blob (via the api proxy) and renders it inline.
export default function ContractPdf({ id }: { id: string }) {
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
