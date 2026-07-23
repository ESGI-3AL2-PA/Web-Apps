/**
 * Config i18next du user-front.
 *
 * Initialise l'instance partagée (traductions fr/en embarquées), branche la
 * détection de langue (localStorage puis navigateur) et synchronise `<html lang>`
 * et le titre du document. Exporte l'instance i18n prête à l'emploi.
 */
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
    fallbackLng: "fr", // français par défaut si la langue détectée est inconnue
    supportedLngs: ["fr", "en"],
    nonExplicitSupportedLngs: true, // "en-US" est accepté et rabattu sur "en"
    load: "languageOnly", // ignore la région : on ne charge que fr / en
    interpolation: { escapeValue: false }, // React échappe déjà le HTML
    detection: {
      order: ["localStorage", "navigator"], // préférence stockée d'abord, sinon langue du navigateur
      lookupLocalStorage: "lang", // clé localStorage où est mémorisé le choix
      caches: ["localStorage"],
    },
  });

// Garde `<html lang>` et le titre du document alignés sur la langue active.
const syncHtmlLang = (lng: string) => {
  document.documentElement.setAttribute("lang", lng);
  document.title = i18n.t("common.appTitle");
};
i18n.on("languageChanged", syncHtmlLang);
syncHtmlLang(i18n.language || "fr");

export default i18n;
