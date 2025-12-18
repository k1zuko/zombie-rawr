import { Suspense } from "react";
import HomePage from "./homePage";
import LoadingScreen from "@/components/LoadingScreen";

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen children={undefined} />}>
      <HomePage />
    </Suspense>
  );
}