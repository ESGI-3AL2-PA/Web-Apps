import { useTranslation } from "react-i18next";
import type { LegalBlock, LegalDoc, LegalLang } from "./content";

// Renders one bilingual legal document (privacy / terms / cookies / legal notice).
// Language follows the app's i18n language; content lives in ./content.ts.

const activeLang = (lng: string): LegalLang => (lng.toLowerCase().startsWith("en") ? "en" : "fr");

function Block({ block, lang }: { block: LegalBlock; lang: LegalLang }) {
  switch (block.type) {
    case "h2":
      return <h2 className="mt-8 mb-2 text-lg font-bold text-neutral-900 dark:text-neutral-50">{block.text[lang]}</h2>;
    case "p":
      return <p className="mb-3 leading-relaxed text-neutral-700 dark:text-neutral-300">{block.text[lang]}</p>;
    case "ul":
      return (
        <ul className="mb-3 list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
          {block.items[lang].map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {block.head[lang].map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-neutral-300 p-2 font-semibold text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows[lang].map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border-b border-neutral-200 p-2 align-top text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const { t, i18n } = useTranslation();
  const lang = activeLang(i18n.language);

  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">{doc.title[lang]}</h1>
      <p className="mt-1 text-neutral-500 dark:text-neutral-400">{doc.intro[lang]}</p>

      <div
        role="note"
        className="my-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <strong>{t("legal.draftBadge")}</strong> {t("legal.draftBanner")}
      </div>

      <p className="mb-2 text-xs text-neutral-400">{t("legal.lastUpdated")}</p>

      {doc.blocks.map((block, i) => (
        <Block key={i} block={block} lang={lang} />
      ))}
    </article>
  );
}
