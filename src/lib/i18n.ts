"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enTranslation from "../locales/en/translation.json";
import idTranslation from "../locales/id/translation.json";
import deTranslation from "../locales/de/translation.json";
import frTranslation from "../locales/fr/translation.json";
import jaTranslation from "../locales/ja/translation.json";
import esTranslation from '../locales/es/translation.json';

const resources = {
    en: {
    translation: enTranslation,
  },
    id: {
    translation: idTranslation,
  },
    de: {
    translation: deTranslation,
  },
    fr: {
    translation: frTranslation,
  },
    ja: {
    translation: jaTranslation,
  },
    es: {
    translation: esTranslation,
  },
};

i18n
  .use(LanguageDetector) // Detect browser language
  .use(initReactI18next) // Integrate with React
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "id","de","fr","ja","es"],
    interpolation: {
      escapeValue: false, // React handles XSS
    },
    detection: {
      order: ["localStorage", "navigator", "cookie"], // localStorage first
      caches: ["localStorage", "cookie"], // Cache language preference
    },
  });

export default i18n;