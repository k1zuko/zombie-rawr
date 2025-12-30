import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Stress Test | QuizRush",
};

export default function StressTestLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
