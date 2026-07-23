// Config : initialise i18next pour l'admin-front (français par défaut, anglais en secours).
// Importé une fois par main.tsx avant le premier render ; exporte l'instance i18n.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

i18n
  .use(LanguageDetector) // détecte la langue (localStorage puis navigateur)
  .use(initReactI18next) // branche i18next sur React
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: "fr",
    supportedLngs: ["fr", "en"],
    nonExplicitSupportedLngs: true, // "fr-FR" est accepté comme "fr"
    load: "languageOnly", // ignore la région : on ne charge que "fr"/"en"
    interpolation: { escapeValue: false }, // React échappe déjà le HTML
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "lang", // clé localStorage où lire/écrire la langue
      caches: ["localStorage"],
    },
  });

// Garde l'attribut <html lang> aligné sur la langue active. Le titre du document est géré par
// AdminLayout (par route), on n'y touche donc pas ici.
const syncHtmlLang = (lng: string) => {
  document.documentElement.setAttribute("lang", lng);
};
i18n.on("languageChanged", syncHtmlLang);
syncHtmlLang(i18n.language || "fr");

export default i18n;
