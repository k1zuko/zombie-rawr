
"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enTranslation from "../locales/en/translation.json";
import idTranslation from "../locales/id/translation.json";

const resources = {
  en: {
    translation: enTranslation,
  },
  id: {
    translation: idTranslation,
  },
};

i18n
  .use(LanguageDetector) // Detect browser language
  .use(initReactI18next) // Integrate with React
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "id"],
    interpolation: {
      escapeValue: false, // React handles XSS
    },
    detection: {
      order: ["navigator", "localStorage", "cookie"], // Detection order
      caches: ["localStorage", "cookie"], // Cache language preference
    },
  });

export default i18n;
