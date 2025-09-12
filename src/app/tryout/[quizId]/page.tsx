"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import QuizPhase from "@/components/tryout/QuizPhase";
import { motion } from "framer-motion";

export default function TryoutPage() {
  const router = useRouter();
  const { quizId } = useParams();

  const [nickname, setNickname] = useState<string | null>(null);
  const [questionsCount, setQuestionsCount] = useState("10");
  const [durationInSeconds, setDurationInSeconds] = useState("300");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedNickname = localStorage.getItem("nickname");
    const quizConfig = localStorage.getItem("quizConfig");

    setNickname(storedNickname);

    if (!storedNickname) {
      router.push("/");
      return;
    }

    if (quizConfig) {
      try {
        const parsed = JSON.parse(quizConfig);
        setQuestionsCount(String(parsed.questions || "10"));
        setDurationInSeconds(String(parsed.duration || "300"));
      } catch (err) {
        console.error("Failed to parse quiz config from localStorage", err);
      }
    }

    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-500 font-mono text-xl animate-pulse"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  if (!nickname) {
    return null; // Render nothing while redirecting
  }

  return (
    <QuizPhase
      quizId={quizId as string}
      nickname={nickname}
      questionsCount={parseInt(questionsCount, 10)}
      durationInSeconds={parseInt(durationInSeconds, 10)}
    />
  )
}