import { headers } from "next/headers";
import { Suspense } from "react";
import HomePage from "./homePage";
import LoadingScreen from "@/components/LoadingScreen";
import type { Metadata } from "next";
import i18n from "@/lib/i18n-server"; // server-side i18n instance

export async function generateMetadata(): Promise<Metadata> {
  // Get full request headers
  const headersList = headers();

  // Extract the full URL from the request headers
  const referer = (await headersList).get("referer") || "";
  const host = (await headersList).get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";

  const url = new URL(referer || `${protocol}://${host}`);
  // const lng = url.searchParams.get("lng") || "en";

  // await i18n.changeLanguage(lng);

  return {
    title: i18n.t("title"),
    description: i18n.t("description"),
  };
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen children={undefined} />}>
      <HomePage />
    </Suspense>
  );
}