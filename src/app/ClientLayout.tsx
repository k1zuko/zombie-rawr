"use client";

import type { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext'; 
import { useEffect, useState } from "react";
import AuthGate from '@/components/authGate';
import ClientProviders from './ClientProvider';
import { getI18nInstance } from "@/lib/i18n";
import { Toaster } from 'react-hot-toast';
import './globals.css';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const i18n = getI18nInstance();
  const [isClient, setIsClient] = useState(false);
  const [currentLang, setCurrentLang] = useState("en");

  useEffect(() => {
    setIsClient(true);
    const savedLang = localStorage.getItem("language");
    if (savedLang && i18n.language !== savedLang && typeof i18n.changeLanguage === "function") {
      i18n.changeLanguage(savedLang);
    }
    setCurrentLang(i18n.language);
  }, [i18n]);

  useEffect(() => {
    if (isClient && i18n.language) {
      document.documentElement.lang = i18n.language;
      setCurrentLang(i18n.language);
    }
  }, [i18n.language, isClient]);

  if (!isClient) {
    return <div className="bg-black min-h-screen" />;
  }

  return (
    <ClientProviders>
      <AuthProvider>
        <AuthGate>
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
        </AuthGate>
      </AuthProvider>
    </ClientProviders>
  );
}