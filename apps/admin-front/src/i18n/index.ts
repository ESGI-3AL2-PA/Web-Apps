import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: "fr",
    supportedLngs: ["fr", "en"],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "lang",
      caches: ["localStorage"],
    },
  });

// Keep <html lang> and the document title in sync with the active language. The route-aware title
// in AdminLayout refines this once mounted; this covers the initial paint and language switches.
const syncHtmlLang = (lng: string) => {
  document.documentElement.setAttribute("lang", lng);
  document.title = i18n.t("common.appTitle");
};
i18n.on("languageChanged", syncHtmlLang);
syncHtmlLang(i18n.language || "fr");

export default i18n;
