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
    description: "Speed thinking or face the chase!",
    manifest: "/manifest.json",
    openGraph: {
      title: "QuizRush",
      description: "Speed thinking or face the chase!",
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
      description: "Speed thinking or face the chase!",
      images: ["/icons/icon-512x512.png"],
    },
  };
}


const zombiefont2Font = localFont({
  src: "../fonts/zombiefont2.ttf",
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
      <body className={`${zombiefont2Font.variable} antialiased`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
