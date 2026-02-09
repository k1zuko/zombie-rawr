"use client";

import { useTranslation } from "react-i18next";

interface PWAInstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export default function PWAInstallBanner({ onInstall, onDismiss }: PWAInstallBannerProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-2 md:bottom-4 left-2 md:left-4 bg-black/90 text-white border-2 border-red-500 rounded-lg p-4 z-50 shadow-lg shadow-red-500/30 animate-fade-in-up sm:p-3 md:p-4 md:text-base">
      <p className="mb-2 text-sm font-semibold leading-tight  text-red-400">{t("pwa.installTitle")}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onInstall}
          className="px-3 py-1 sm:py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-md  transition-colors text-xs "
        >
          {t("pwa.install")}
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 border border-red-500 text-red-400 hover:bg-red-500/10 rounded-md transition-colors text-xs "
        >
          {t("pwa.later")}
        </button>
      </div>
    </div>
  );
}
