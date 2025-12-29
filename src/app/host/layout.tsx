import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Host | QuizRush",
};

export default function HostLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}