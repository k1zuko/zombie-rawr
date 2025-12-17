"use client";

import { useState, useEffect } from "react";
import { CircleQuestionMark, CheckCircle, XCircle, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
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

export default function QuizPhase({ quizId, nickname, questionsCount, durationInSeconds }: QuizPhaseProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(durationInSeconds);
  const [answers, setAnswers] = useState<Array<{ questionId: string; selected: string; correct: boolean }>>([]);
  const FEEDBACK_DURATION = 1000;
  const [timeReady, setTimeReady] = useState(false);
  const [indexReady, setIndexReady] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  
  const CORRECT_KEY = `tryout_correct_${quizId}_${nickname}`;
  const saveCorrect = (n: number) => localStorage.setItem(CORRECT_KEY, String(n));
  const loadCorrect = () => Number(localStorage.getItem(CORRECT_KEY) || 0);
  const [correctAnswers, setCorrectAnswers] = useState(loadCorrect());
  
  useEffect(() => {
    if (timeLeft <= 0) {
      finishQuiz();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    const endTimeKey = `tryout_endTime_${quizId}_${nickname}`;
    const existingEndTime = localStorage.getItem(endTimeKey);

    let endTime: number;
    if (existingEndTime) {
      endTime = Number(existingEndTime);
    } else {
      endTime = Date.now() + durationInSeconds * 1000;
      localStorage.setItem(endTimeKey, String(endTime));
    }

    const calcRemaining = () => Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    setTimeLeft(calcRemaining());
    setTimeReady(true);

    const interval = setInterval(() => {
      const remaining = calcRemaining();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        finishQuiz();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const shuffleQuestions = (questions: any[]) => {
    return questions
      .map((value) => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value)
      .slice(0, Math.min(questionsCount, questions.length));
  };

  useEffect(() => {
    const QUIZ_KEY = `tryout_questions_${quizId}_${nickname}`;
    const INDEX_KEY = `tryout_index_${quizId}_${nickname}`;

    const loadQuestions = (): Question[] | null => {
      const raw = localStorage.getItem(QUIZ_KEY);
      return raw ? JSON.parse(raw) : null;
    };
    const saveQuestions = (q: Question[]) =>
      localStorage.setItem(QUIZ_KEY, JSON.stringify(q));

    const loadIndex = () => {
      const raw = localStorage.getItem(INDEX_KEY);
      return raw ? Number(raw) : 0;
    };

    const fetchQuestions = async () => {
      setIsLoading(true);
      try {
        let qs = loadQuestions();
        if (!qs) {
          // player pertama kali main → ambil & acak
          const { data, error } = await supabase
            .from("quiz_questions")
            .select("id, quiz_id, question_text, question_type, image_url, options, correct_answer")
            .eq("quiz_id", quizId);

          if (error || !data?.length) {
            setError(t("errorMessages.noQuestionsFound"));
            return;
          }

          // acak sekali saja
          qs = data
            .map((q) => ({ ...q, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ sort, ...rest }) => rest)
            .slice(0, questionsCount);

          saveQuestions(qs);
        }

        setQuestions(qs);
        const idx = loadIndex();
        setCurrentQuestionIndex(idx);
        setIndexReady(true);
        setIsLoading(false);
      } catch {
        setError(t("errorMessages.fetchQuestionsFailed"));
      }
    };

    fetchQuestions();
  }, [quizId, questionsCount, nickname, t]);


  /* 2. Effect simpan nomor soal saat user berpindang */
  useEffect(() => {
    if (!indexReady) return;
    const INDEX_KEY = `tryout_index_${quizId}_${nickname}`;
    localStorage.setItem(INDEX_KEY, String(currentQuestionIndex));
  }, [currentQuestionIndex, indexReady, quizId, nickname]);


  const handleAnswerSelect = async (answer: string) => {
    if (isAnswered || !currentQuestion || isProcessingAnswer) return;

    setIsProcessingAnswer(true);
    setSelectedAnswer(answer);
    setIsAnswered(true);

    const isCorrectAnswer = answer === currentQuestion.correct_answer;
    setIsCorrect(isCorrectAnswer);
    setShowFeedback(true);

    const newAnswer = {
      questionId: currentQuestion.id,
      selected: answer,
      correct: isCorrectAnswer,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (isCorrectAnswer) {
      setCorrectAnswers((prev) => {
        const next = prev + 1;
        saveCorrect(next);
        return next;
      });
    }

    setTimeout(() => {
      setShowFeedback(false);
      if (currentQuestionIndex + 1 >= totalQuestions) {
        finishQuiz();
      } else {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setIsCorrect(null);
        setIsProcessingAnswer(false);
      }
    }, FEEDBACK_DURATION);
  };

  const finishQuiz = () => {
    const result = {
      quizId,
      nickname,
      correctAnswers: loadCorrect(),
      totalQuestions,
      timeSpent: durationInSeconds - timeLeft,
      timestamp: Date.now(),
    };
    localStorage.setItem(`tryoutResult_${quizId}_${nickname}`, JSON.stringify(result));
    router.push(`/tryout/${quizId}/results`);
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

  if (!timeReady || !indexReady || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-500  text-xl animate-pulse"
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
            className="text-red-500  text-xl"
          >
            {error || t("errorMessages.noQuestionsFound", { defaultValue: "No questions found for this quiz" })}
          </motion.div>
          <Button
            onClick={() => router.push("/quiz-select-tryout")}
            className="mt-4 bg-red-800 text-white border-red-600 "
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
      <div className="relative z-10 container mx-auto p-4 md:p-7">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h1
                className="text-4xl md:text-6xl   tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse"
                style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
              >
                {t("title")}
              </h1>
            </motion.div>
          </div>
          <div className="inline-flex items-center gap-x-5 mx-auto px-4 py-2 mb-5 border border-red-500/30 rounded-full bg-black/40  text-sm">
            <div className="flex items-center gap-x-1">
              <CircleQuestionMark className="w-4 h-4 text-purple-400" />
              <span className="text-white">
                {currentQuestionIndex + 1}/{totalQuestions}
              </span>
            </div>
            <div className="flex items-center gap-x-1">
              <Clock
                className={`w-4 h-4 ${timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-yellow-500"}`}
              />
              <span className={`${timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-white"}`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
          <Card className="max-w-4xl mx-auto bg-gray-900/90 border-red-900/50 backdrop-blur-sm p-0">
            <div className="p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-purple-500/5" />
              <motion.div
                key={currentQuestion?.id} // Use key to trigger animation on question change
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              >
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
                    <h2 className="text-2xl  text-white leading-relaxed">{currentQuestion.question_text}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentQuestion.options.map((option: string, index: number) => (
                      <Button
                        key={index}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={isAnswered || isProcessingAnswer}
                        className={`${getAnswerButtonClass(option)} p-6 text-left justify-start  text-lg border-2 transition-all duration-300 relative overflow-hidden group ${isProcessingAnswer ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        <div className="flex items-center space-x-3 relative z-10">
                          <span className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-sm ">
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
              </motion.div>
            </div>
          </Card>
        </div>
        <ZombieFeedback isCorrect={isCorrect} isVisible={showFeedback} activeZombie={null} activePlayer={null} />
      </div>
    </div>
  );
}