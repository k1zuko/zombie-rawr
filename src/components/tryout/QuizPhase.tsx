"use client";

import { useState, useEffect } from "react";
import { CircleQuestionMark, CheckCircle, XCircle } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import ZombieFeedback from "../game/ZombieFeedback";
import { useTranslation } from "react-i18next";

interface QuizPhaseProps {
  quizId: string;
  nickname: string;
  questionsCount: number;
  durationInSeconds: number;
}

interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: string;
  image_url?: string;
  options: string[];
  correct_answer: string;
}

export default function QuizPhase({ quizId, nickname, questionsCount, durationInSeconds  }: QuizPhaseProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const FEEDBACK_DURATION = 1000;

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("quiz_questions")
          .select("id, quiz_id, question_text, question_type, image_url, options, correct_answer")
          .eq("quiz_id", quizId)
          .limit(questionsCount)

        if (error) {
          console.error("Supabase error fetching quiz_questions:", error.message);
          throw new Error(error.message);
        }
        if (!data || data.length === 0) {
          setError(t("errorMessages.noQuestionsFound", { defaultValue: "No questions found for this quiz" }));
          return;
        }
        setQuestions(data);
      } catch (err: any) {
        console.error("Failed to fetch quiz_questions:", err.message);
        setError(t("errorMessages.fetchQuestionsFailed", { defaultValue: "Failed to fetch questions" }));
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [quizId, t]);

  const handleAnswerSelect = async (answer: string) => {
    if (isAnswered || !currentQuestion || isProcessingAnswer) return;

    setIsProcessingAnswer(true);
    setSelectedAnswer(answer);
    setIsAnswered(true);

    const isCorrectAnswer = answer === currentQuestion.correct_answer;
    setIsCorrect(isCorrectAnswer);
    setShowFeedback(true);

    if (isCorrectAnswer) {
      setCorrectAnswers((prev) => prev + 1);
    }

    setTimeout(() => {
      setShowFeedback(false);
      if (currentQuestionIndex + 1 >= totalQuestions) {
        const result = {
          quizId,
          nickname,
          correctAnswers: isCorrectAnswer ? correctAnswers + 1 : correctAnswers,
          totalQuestions,
          timestamp: Date.now(),
        };
        localStorage.setItem(`tryoutResult_${quizId}_${nickname}`, JSON.stringify(result));
        router.push(`/tryout/${quizId}/results`);
      } else {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setIsCorrect(null);
      }
      setIsProcessingAnswer(false);
    }, FEEDBACK_DURATION);
  };

  const getAnswerButtonClass = (option: string) => {
    if (!isAnswered) {
      return "bg-gray-800 border-gray-600 text-white";
    }
    if (option === currentQuestion?.correct_answer) {
      return "bg-green-600 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]";
    }
    if (option === selectedAnswer && option !== currentQuestion?.correct_answer) {
      return "bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]";
    }
    return "bg-gray-700 border-gray-600 text-gray-400";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-500 font-mono text-xl animate-pulse"
        >
          {t("loadingQuestion", { defaultValue: "Loading question..." })}
        </motion.div>
      </div>
    );
  }

  if (error || !currentQuestion) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-500 font-mono text-xl"
          >
            {error || t("errorMessages.noQuestionsFound", { defaultValue: "No questions found for this quiz" })}
          </motion.div>
          <Button
            onClick={() => router.push("/quiz-select-tryout")}
            className="mt-4 bg-red-800 text-white border-red-600 font-mono"
          >
            {t("backToQuizSelect", { defaultValue: "Back to Quiz Selection" })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/15 via-black to-purple-950/15" style={{ opacity: 0.3 }} />
      <div className="relative z-10 container mx-auto px-4 pt-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h1
                className="text-4xl md:text-6xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse"
                style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
              >
                {t("title")}
                {/* {t("title", { defaultValue: "Quiz Game" })} - {nickname} */}
              </h1>
            </motion.div>
          </div>
          <div className="inline-flex items-center gap-x-5 mx-auto px-4 py-2 mb-5 border border-red-500/30 rounded-full bg-black/40 font-mono text-sm">
            <div className="flex items-center gap-x-1">
              <CircleQuestionMark className="w-4 h-4 text-purple-400" />
              <span className="text-white">
                {currentQuestionIndex + 1}/{totalQuestions}
              </span>
            </div>
          </div>
          <Card className="max-w-4xl mx-auto bg-gray-900/90 border-red-900/50 backdrop-blur-sm p-0">
            <div className="p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-purple-500/5" />
              <div className="relative z-10">
                {currentQuestion.question_type === "IMAGE" && currentQuestion.image_url && (
                  <div className="mb-4 text-center">
                    <img
                      src={currentQuestion.image_url || "/placeholder.svg"}
                      alt={currentQuestion.question_text}
                      className="max-w-xs max-h-48 mx-auto rounded-lg"
                    />
                  </div>
                )}
                <div className="flex items-start space-x-4 mb-8">
                  <h2 className="text-2xl font-bold text-white leading-relaxed">{currentQuestion.question_text}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentQuestion.options.map((option: string, index: number) => (
                    <Button
                      key={index}
                      onClick={() => handleAnswerSelect(option)}
                      disabled={isAnswered || isProcessingAnswer}
                      className={`${getAnswerButtonClass(option)} p-6 text-left justify-start font-mono text-lg border-2 transition-all duration-300 relative overflow-hidden group ${
                        isProcessingAnswer ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="flex items-center space-x-3 relative z-10">
                        <span className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-sm font-bold">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="flex-1 whitespace-normal">{option}</span>
                        {isAnswered && option === currentQuestion.correct_answer && (
                          <CheckCircle className="w-5 h-5 ml-auto animate-pulse" />
                        )}
                        {isAnswered &&
                          option === selectedAnswer &&
                          option !== currentQuestion.correct_answer && (
                            <XCircle className="w-5 h-5 ml-auto animate-pulse" />
                          )}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
        <ZombieFeedback isCorrect={isCorrect} isVisible={showFeedback} activeZombie={null} activePlayer={null} />
      </div>
    </div>
  );
}