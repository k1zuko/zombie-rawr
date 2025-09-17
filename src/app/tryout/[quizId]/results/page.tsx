"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Target, Clock, Zap, Skull, Home } from "lucide-react";
import Link from "next/link";
import { HorrorCard } from "@/components/ui/horror-card";

interface Result {
  quizId: string;
  nickname: string;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;
  timestamp: number;
}

export default function TryoutResultsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { quizId } = useParams();
  const [result, setResult] = useState<Result | null>(null);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    const nickname = localStorage.getItem("nickname");
    if (!nickname) {
      router.replace("/");
      return;
    }
    const key = `tryoutResult_${quizId}_${nickname}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      router.replace("/quiz-select-tryout");
      return;
    }
    setResult(JSON.parse(raw));
  }, [quizId, router]);

  const clearTryoutData = () =>
    result &&
    [`tryout_questions_${quizId}_${result.nickname}`,
    `tryout_index_${quizId}_${result.nickname}`,
    `tryout_correct_${quizId}_${result.nickname}`,
    `tryout_endTime_${quizId}_${result.nickname}`,
    `tryoutResult_${quizId}_${result.nickname}`,
      "nickname"]
      .forEach(k => localStorage.removeItem(k));

  const getPercentage = (correct: number, total: number) => {
    if (!total) return "0%";
    return ((correct / total) * 100).toFixed(0) + "%";
  };

  if (!result) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-500 font-mono text-xl animate-pulse"
        >
          {t("loading")}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/15 via-black to-purple-950/15" style={{ opacity: 0.3 }} />
      <div className="relative z-10 mx-auto p-5 md:p-7">
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-1 mb-7 md:mb-10"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <Link href={"/"}>
                <h1
                  className="text-xl md:text-4xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                  style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
                >
                  {t("title")}
                </h1>
              </Link>
            </div>

            <div className="flex w-fit gap-2 items-center">
              <img
                src={`/logo/gameforsmartlogo-horror.png`}
                alt="Game for Smart Logo"
                className="w-36 md:w-52 lg:w-64 h-auto"
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
            className="flex justify-center items-center text-center"
          >
            <Skull className="w-12 h-12 text-red-500 animate-pulse" />
            <h1
              className={`mx-3 text-5xl font-bold font-mono tracking-wider transition-all duration-150 animate-pulse text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("result.title")}
            </h1>
            <Skull className="w-12 h-12 text-red-500 animate-pulse" />
          </motion.div>
        </motion.header>
        <HorrorCard variant="blood" glowing animated className="max-w-4xl mx-auto mb-8 p-0">
          <div className="p-7 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/4 w-1 h-16 bg-red-900/70" />
            <div className="absolute top-0 right-1/3 w-1 h-10 bg-red-900/70" />

            <div className="relative z-10 space-y-7">
              <h2 className="text-3xl font-bold text-white font-horror tracking-wider text-red-500 py-3">
                {result.nickname}
              </h2>

              <div className="grid grid-cols-3 gap-3">
                {/* Correct */}
                <div className="bg-gray-900/70 rounded-lg p-4 border border-green-900/50">
                  <Target className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white font-mono">{result.correctAnswers}</div>
                  <div className="text-xs text-gray-400 tracking-widest">{t("correct")}</div>
                </div>

                {/* Time Spent */}
                <div className="bg-gray-900/70 rounded-lg p-4 border border-blue-900/50">
                  <Clock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white font-mono">{formatTime(result.timeSpent)}</div>
                  <div className="text-xs text-gray-400 tracking-widest">{t("duration")}</div>
                </div>

                {/* Accuracy */}
                <div className="bg-gray-900/70 rounded-lg p-4 border border-purple-900/50">
                  <Zap className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white font-mono">
                    {getPercentage(result.correctAnswers, result.totalQuestions)}
                  </div>
                  <div className="text-xs text-gray-400 tracking-widest">{t("accuracy")}</div>
                </div>
              </div>
            </div>
          </div>
        </HorrorCard>
        <div className="flex justify-center items-center">
          {/* Tombol Home */}
          <motion.button
            onClick={() => {
              clearTryoutData();
              router.replace("/")
            }}
            whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            whileTap={{ scale: 0.95 }}
            // Ganti padding & tambahkan aria-label
            className="bg-red-800 text-white p-2 px-3 border-2 font-mont font-semibold border-red-600 rounded-md mx-auto"
            aria-label={t("homeButton")} // Penting untuk aksesibilitas
          >
            {t("homeButton")}
          </motion.button>
        </div>
      </div>
    </div>
  );
}