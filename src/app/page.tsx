
import { Suspense } from "react";
import HomePage from "./homePage";
import LoadingScreen from "@/components/game/LoadingScreen";
import type { Metadata } from "next";
import i18n from "@/lib/i18n-server"; // Use server-side i18n

export async function generateMetadata({ params, searchParams }: { params: any; searchParams: any }): Promise<Metadata> {
  // Get language from query parameter or default to 'en'
  const lng = searchParams?.lng || "en";
  await i18n.changeLanguage(lng);

  return {
    title: i18n.t("title"),
    description: i18n.t("description"),
  };
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <HomePage />
    </Suspense>
  );
}
