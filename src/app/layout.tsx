import type { Metadata } from "next";
import { headers } from "next/headers";
import ClientLayout from "./ClientLayout";
import localFont from "next/font/local";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") || "quizrush.gameforsmart.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const fullUrl = `${protocol}://${host}`;

  return {
    metadataBase: new URL(fullUrl),
    title: "QuizRush",
    description: "Answer - Run - Survive",
    manifest: "/manifest.json",
    openGraph: {
      title: "QuizRush",
      description: "Answer - Run - Survive",
      url: fullUrl,
      siteName: "QuizRush",
      images: [
        {
          url: "/icons/icon-512x512.png",
          width: 512,
          height: 512,
          alt: "QuizRush Logo",
        }
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "QuizRush",
      description: "Answer - Run - Survive",
      images: ["/icons/icon-512x512.png"],
    },
  };
}

const zombiefont2Font = localFont({
  // src: "../fonts/zombiefont2.ttf",
  // src: "../fonts/blackfang.otf",
  // src: "../fonts/skullandvoid.otf",
  // src: "../fonts/deadfontwalking.otf",
  // src: "../fonts/misfit2.ttf",
  src: "../fonts/family.ttf",
  variable: "--font-zombiefont2",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${zombiefont2Font.variable} antialiased tracking-wider`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
