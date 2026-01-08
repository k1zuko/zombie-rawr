import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Test | QuizRush",
};

export default function TestLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
