"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "./ClientProviders";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import LoadingScreenPreload from "@/components/LoadingScreenPreload";
import Script from "next/script"; // ✅ Tambahkan ini

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedLang = localStorage.getItem("language");
    if (savedLang && i18n.language !== savedLang) {
      i18n.changeLanguage(savedLang);
    }
  }, [i18n]);

  useEffect(() => {
    if (isClient) {
      document.documentElement.lang = i18n.language;
    }
  }, [i18n.language, isClient]);



  return (
    <html lang={isClient ? i18n.language : "en"}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <ClientProviders>
            <LoadingScreenPreload />
            {children}
            <Toaster
              position="top-center"
              reverseOrder={false}
              gutter={8}
              toastOptions={{
                duration: 2000,
                style: {
                  background: '#1a0000',
                  color: '#ff4444',
                  border: '1px solid #ff0000',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                },
                success: {
                  style: {
                    background: '#1a0000',
                    color: '#44ff44',
                    border: '1px solid #44ff44',
                  },
                },
                error: {
                  style: {
                    background: '#1a0000',
                    color: '#ff0000',
                    border: '1px solid #ff0000',
                  },
                },
              }}
            />
          </ClientProviders>
        </AuthProvider>
      </body>
    </html>
  );
}