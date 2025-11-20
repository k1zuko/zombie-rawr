"use client";

import { ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n"; // Use client-side i18n
import { motion } from "framer-motion";
import { PreloadProvider } from "@/contexts/PreloadContext";

export default function ClientProviders({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (i18n.isInitialized) {
      setIsReady(true);
    } else {
      i18n.on("initialized", () => {
        setIsReady(true);
      });
    }
  }, []);
1
  if (!isReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <PreloadProvider>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </PreloadProvider>
  );
}