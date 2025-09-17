"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "./ClientProviders";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
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

  // ✅ Daftar gambar karakter yang dipakai di game — preload agar cepat muncul
  const characterImages = [
    "/character/player/character.webp",
    "/character/player/character1-crop.webp",
    "/character/player/character2-crop.webp",
    "/character/player/character3-crop.webp",
    "/character/player/character4-crop.webp",
    "/character/player/character5.webp",
    "/character/player/character6.webp",
    "/character/player/character7-crop.webp",
    "/character/player/character8-crop.webp",
    "/character/player/character9-crop.webp",
    "/character/chaser/zombie.webp",
    "/character/chaser/monster1.webp",
    "/character/chaser/monster2.webp",
    "/character/chaser/monster3.webp",
    "/character/chaser/darknight.webp",
    "/map6/6.webp",
    "/map6/1.webp",
    "/map6/2.webp",
    "/map6/3.webp",
    "/map6/4.webp",
    "/map6/5.webp",
    "/map6/7.webp",
    "/map6/8.webp",
    "/map6/9.webp",
    // Tambahkan gambar lain yang sering muncul di g
  ];

  return (
    <html lang={isClient ? i18n.language : "en"}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <ClientProviders>
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