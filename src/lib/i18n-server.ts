
import i18n from "i18next";
import enTranslation from "../locales/en/translation.json";
import idTranslation from "../locales/id/translation.json";
import deTranslation from "../locales/de/translation.json";
import frTranslation from "../locales/fr/translation.json";
import jaTranslation from "../locales/ja/translation.json";
import esTranslation from '../locales/es/translation.json';

// Initialize i18next for server-side
i18n.init({
  resources: {
    en: { translation: enTranslation },
    id: { translation: idTranslation },
    de: { translation: deTranslation},
    fr: { translation: frTranslation},
    ja: { translation: jaTranslation},
    es: { translation: esTranslation},
    

  },
  fallbackLng: "en",
  supportedLngs: ["en", "id", "de", "fr", "ja", "es"],
  interpolation: {
    escapeValue: false, // No need for escaping in server context
  },
});

export default i18n;