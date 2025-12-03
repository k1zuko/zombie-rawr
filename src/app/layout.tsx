import type { Metadata } from 'next';
import { Geist, Geist_Mono } from "next/font/google";
import ClientLayout from './ClientLayout';

export const metadata: Metadata = {
  title: "QuizRush",
  description: "Speed thinking or face the chase!",
  // manifest: "/manifest.json",
  // icons: {
  //   icon: "/icons/icon-192x192.png",
  //   shortcut: "/favicon.ico",
  //   apple: "/icons/icon-512x512.png",
  // },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* <link rel="manifest" href="/manifest.json" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" fetchPriority='high'/>
        <link rel="prefetch" as="image" href="/gameforsmartlogo.webp" type="image/webp" fetchPriority="high" />
        <link rel="preload" as="image" href="/assets/background/1.webp" type="image/webp" fetchPriority="high" />
        <link rel="preload" as="image" href="/assets/background/host/10.webp" type="image/webp" fetchPriority="high" /> */}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}