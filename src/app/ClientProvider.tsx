"use client";

import { ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { getI18nInstance } from "@/lib/i18n";
import LoadingScreenPreload from "@/components/LoadingScreenPreload";
import LoadingScreen from "@/components/LoadingScreen";

export default function ClientProviders({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [i18nInstance] = useState(() => getI18nInstance());

  useEffect(() => {
    if (i18nInstance.isInitialized) setIsReady(true);
    else i18nInstance.on("initialized", () => setIsReady(true));
  }, [i18nInstance]);

  if (!isReady) {
    <LoadingScreen children={undefined} />
  }

  return (
      <I18nextProvider key={i18nInstance.language} i18n={i18nInstance}>
        {children}
      </I18nextProvider>
  );
}