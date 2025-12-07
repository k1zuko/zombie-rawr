// Ganti import jika perlu (tetap sama)
"use client"

import { useState, useEffect, useRef } from "react"
import { AlertTriangle, CheckCircle, CircleQuestionMark, Clock, Heart, Skull, XCircle, Zap } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { mysupa } from "@/lib/supabase"
import { AnimatePresence, motion } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import ZombieFeedback from "@/components/game/ZombieFeedback"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"
import LoadingScreen from "@/components/LoadingScreen"
import { generateXID } from "@/lib/id-generator"

// === TIPE BARU YANG SESUAI DENGAN SKEMA BARU ===
export interface Session {
  id: string
  game_pin: string
  quiz_id: string
  status: "waiting" | "active" | "finished"
  question_limit: number
  total_time_minutes: number
  difficulty: string
  current_questions: any[]        // jsonb → array pertanyaan
  host_id: string | null
  created_at: string
  started_at: string | null
}

interface Participant {
  id: string
  session_id: string
  user_id: string | null
  nickname: string
  character_type: string
  is_host: boolean
  score: number
  correct_answers: number
  health: {
    current: number
    max: number
    speed: number
    last_attack_time: string | null
    is_being_attacked: boolean
  }
  position_x: number
  position_y: number
  is_alive: boolean
  power_ups: number
  joined_at: string
  answers: any[]                  // jsonb → array jawaban
  finished_at: string
}

// === GANTI SEMUA TIPE LAMA ===
export default function QuizPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const gamePin = params.roomCode as string   // ← sekarang game_pin, bukan room_code

  const [session, setSession] = useState<Session | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Participant | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [timeLoaded, setTimeLoaded] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [playerHealth, setPlayerHealth] = useState(100)     // ← sekarang 100, bukan 3
  const [playerSpeed, setPlayerSpeed] = useState(1)        // ← default speed dari health json
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false)

  // Ambil pertanyaan dari session
  const questions = session?.current_questions ?? []
  const totalQuestions = session?.question_limit ?? questions.length ?? 0
  const currentQuestion = questions[currentQuestionIndex] ?? null

  const pulseIntensity = timeLeft <= 30 ? (31 - timeLeft) / 30 : 0
  const FEEDBACK_DURATION = 1200

  // Initial data fetching → GANTI SEMUA INI
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!gamePin) {
        router.replace("/");
        return;
      }

      // 1. Ambil session berdasarkan game_pin
      const { data: sessionData, error: sessionError } = await mysupa
        .from("sessions")
        .select("*")
        .eq("game_pin", gamePin)
        .single();

      if (sessionError || !sessionData) {
        console.error("Session tidak ditemukan:", sessionError);
        toast.error("Kode game salah atau sudah expired!");
        router.replace("/");
        return;
      }

      setSession(sessionData);

      // 2. Ambil player dari localStorage (playerId tetap sama)
      const playerId = localStorage.getItem("playerId");
      if (!playerId) {
        toast.error("Kamu belum bergabung ke game ini.");
        router.replace("/");
        return;
      }

      // 3. Cari participant di tabel participants
      const { data: participantData, error: participantError } = await mysupa
        .from("participants")
        .select("*")
        .eq("session_id", sessionData.id)
        .eq("id", playerId)  // atau gunakan user_id jika pakai auth
        .single();

      if (participantError || !participantData) {
        console.error("Player tidak ditemukan di session ini");
        toast.error("Kamu tidak terdaftar di game ini.");
        router.replace("/");
        return;
      }

      setCurrentPlayer(participantData);
      setPlayerHealth(participantData.health.current);
      setPlayerSpeed(participantData.health.speed || 1);
      setCorrectAnswers(participantData.correct_answers || 0);

      // Hitung index pertanyaan berikutnya dari answers.length
      const answeredCount = participantData.answers?.length || 0;
      setCurrentQuestionIndex(answeredCount);

      setIsClient(true);
    };

    fetchInitialData();
  }, [gamePin, router]);

  // Realtime: Dengarkan perubahan di session & participant
useEffect(() => {
  if (!session?.id) return;

  // Subscribe ke session
  const sessionChannel = mysupa
    .channel(`session:${session.id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` },
      (payload) => {
        setSession(payload.new as Session);
      }
    )
    .subscribe();

  // Subscribe ke participant (hanya diri sendiri)
  const playerId = localStorage.getItem("playerId");
  if (playerId) {
    const participantChannel = mysupa
      .channel(`participant:${playerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `id=eq.${playerId}` },
        (payload) => {
          const updated = payload.new as Participant;
          
          setCurrentPlayer(updated);
          setPlayerHealth(updated.health.current);
          setPlayerSpeed(updated.health.speed || 1);
          setCorrectAnswers(updated.correct_answers || 0);

          // INI YANG KAMU CARI → index soal ikut jumlah jawaban
          // const nextQuestionIndex = updated.answers?.length || 0;
          // setCurrentQuestionIndex(nextQuestionIndex);
        }
      )
      .subscribe();
  }

  return () => {
    mysupa.removeAllChannels();
  };
}, [session?.id]);

  // Game Timer → dari started_at
  useEffect(() => {
    if (!session?.started_at || !session.total_time_minutes) return;

    const startTime = new Date(session.started_at).getTime();
    const durationSec = session.total_time_minutes * 60;

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, durationSec - elapsed, 0);
      setTimeLeft(remaining);
      if (!timeLoaded) setTimeLoaded(true);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.started_at, session?.total_time_minutes, timeLoaded]);



  useEffect(() => {
    if (timeLoaded && timeLeft <= 0 && !isProcessingAnswer) {
      redirectToResults(playerHealth, correctAnswers, currentQuestionIndex, true);
    }
  }, [timeLeft, timeLoaded, isProcessingAnswer, playerHealth, correctAnswers, currentQuestionIndex]);

  // Feedback and question progression
  useEffect(() => {
    if (!showFeedback) return;

    const timer = setTimeout(() => {
      setShowFeedback(false);

      // Health <= 0 baru ke result, tapi tetap tunggu feedback selesai
      if (playerHealth <= 0) {
        redirectToResults(0, correctAnswers, totalQuestions, true);
        return;
      }

      // Semua soal selesai
      // if (currentQuestionIndex >= totalQuestions) {
      //   redirectToResults(playerHealth, correctAnswers, totalQuestions, false);
      //   return;
      // }

      // Lanjut soal berikutnya
      nextQuestion();
    }, FEEDBACK_DURATION);

    return () => clearTimeout(timer);
  }, [showFeedback, playerHealth, currentQuestionIndex, totalQuestions, correctAnswers]);

  const getDangerLevel = () => {
    if (playerHealth <= 1) return 3
    if (playerHealth <= 2) return 2
    return 1
  }
  const dangerLevel = getDangerLevel()

  // === GANTI FUNGSI calculateSurvivalDuration ===
  const calculateSurvivalDuration = () => {
    if (!session?.started_at) return 0;

    const gameStartTime = new Date(session.started_at).getTime();
    const nowOrFinished = currentPlayer?.finished_at
      ? new Date(currentPlayer.finished_at).getTime()
      : Date.now();

    return Math.floor((nowOrFinished - gameStartTime) / 1000);
  };

  // === VERSI FINAL: HANYA UPDATE participants, TIDAK ADA game_completions ===
  const saveGameCompletion = async (
    finalHealth: number,
    finalCorrect: number,
    totalAnswered: number,
    isEliminated = false,
  ) => {
    if (!currentPlayer || !session?.id) return;

    const survivalDuration = calculateSurvivalDuration();

    try {
      // hitung skor per soal berdasarkan totalQuestions/session.question_limit
      const questionsCount = session?.question_limit ?? (session?.current_questions?.length ?? 0);
      const perQuestionScore = questionsCount > 0 ? Math.floor(100 / questionsCount) : 100;

      // CUKUP UPDATE participants DOANG → semua data udah lengkap di sini!
      const { error } = await mysupa
        .from("participants")
        .update({
          finished_at: new Date().toISOString(),           // waktu selesai
          completion: true,
          // score: finalCorrect * perQuestionScore,          // skor akhir menyesuaikan jumlah soal
          // correct_answers: finalCorrect,
          // answers: currentPlayer.answers,                   // tetap simpan (sudah ada)
          health: {
            ...currentPlayer.health,
            current: Math.max(0, finalHealth)
          },
          is_alive: finalHealth > 0
        })
        .eq("id", currentPlayer.id);

      if (error) throw error;

      console.log("Player selesai! Survival:", survivalDuration, "detik");
    } catch (error) {
      console.error("Gagal simpan hasil akhir:", error);
    }
  };

  const submitAnswer = async (answer: string, isCorrectAnswer: boolean) => {
    if (!session || !currentPlayer) return;

    setIsProcessingAnswer(true);

    const newAnswerEntry = {
      id: generateXID(),
      correct: isCorrectAnswer,
      answer_id: currentQuestion.answers.findIndex((a: any) => a.answer === answer).toString(),
      question_id: currentQuestion.id
    };

    const updatedAnswers = [...(currentPlayer.answers || []), newAnswerEntry];

    const newHealthValue = isCorrectAnswer
      ? currentPlayer.health.current
      : Math.max(0, currentPlayer.health.current - 1);

    // adjust speed: +5 if correct, -5 if wrong, minimum 20
    const currentSpeed = currentPlayer.health.speed ?? 20;
    const newSpeed = Math.max(20, currentSpeed + (isCorrectAnswer ? 5 : -5));

    // hitung skor per soal berdasarkan totalQuestions/session.question_limit
    const questionsCount = session?.question_limit ?? (session?.current_questions?.length ?? 0);
    const perQuestionScore = questionsCount > 0 ? Math.floor(100 / questionsCount) : 100;

    const correctCount = updatedAnswers.filter((a: any) => a.correct === true).length;
    const newScore = correctCount * perQuestionScore;


    const { error } = await mysupa
      .from("participants")
      .update({
        answers: updatedAnswers,
        correct_answers: correctCount,
        score: newScore,
        health: {
          ...currentPlayer.health,
          current: newHealthValue,
          speed: newSpeed,
        },
      })
      .eq("id", currentPlayer.id);

    setIsProcessingAnswer(false);

    if (error) {
      console.error("Gagal simpan jawaban:", error);
      toast.error("Jawaban gagal dikirim!");
      // Kembalikan tombol ke aktif kalau gagal
      setIsAnswered(false);
      return;
    }

    // Update local UI state agar speed, health & skor berubah langsung
    setPlayerHealth(newHealthValue);
    setPlayerSpeed(newSpeed);
    setCurrentPlayer(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        health: {
          ...prev.health,
          current: newHealthValue,
          speed: newSpeed,
          last_answer_time: new Date().toISOString(),
        },
        correct_answers: correctCount,
        score: newScore,
        answers: updatedAnswers,
      };
    });
  };

  const redirectToResults = async (
    health: number,
    correct: number,
    total: number,
    isEliminated = false,
  ) => {
    if (!currentPlayer || !session) return;

    // Cukup panggil ini → semua data udah tersimpan rapi di participants
    await saveGameCompletion(health, correct, total, isEliminated);

    const lastResult = {
      playerId: currentPlayer.id,
      gamePin: gamePin,
      nickname: currentPlayer.nickname,
      character: currentPlayer.character_type,
      finalHealth: Math.max(0, health),
      correctAnswers: correct,
      totalQuestions: total,
      survivalSeconds: calculateSurvivalDuration(),
      eliminated: isEliminated || health <= 0,
      timestamp: Date.now(),
    };

    localStorage.setItem("lastGameResult", JSON.stringify(lastResult));
    router.push(`/player/${gamePin}/result`);
  };

  const nextQuestion = () => {
    setCurrentQuestionIndex(prev => {
      const next = prev + 1;
      // Kalau udah habis soal → langsung ke result
      if (next >= totalQuestions) {
        redirectToResults(playerHealth, correctAnswers, totalQuestions, playerHealth <= 0);
        return prev; // jangan naik lagi
      }
      return next;
    });

    // Reset state jawaban
    setSelectedAnswer(null);
    setIsAnswered(false);
    setIsCorrect(null);
  };

  const handleAnswerSelect = async (answer: string, index: number) => {
    if (isAnswered || !currentQuestion || isProcessingAnswer) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);

    const isCorrectAnswer = index.toString() === currentQuestion.correct;

    setIsCorrect(isCorrectAnswer);
    setShowFeedback(true);

    await submitAnswer(answer, isCorrectAnswer);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`
  }

  const getAnswerButtonClass = (option: string, index: number) => {
    if (!isAnswered) {
      return "bg-gray-800 border-gray-600 text-white"
    }

    const optionLetter = String.fromCharCode(97 + index);
    const correctAnswerLetter = currentQuestion.correct_answer.trim().toLowerCase();
    const isCorrectOption = optionLetter === correctAnswerLetter;

    const isSelectedOption = option.trim().toLowerCase() === selectedAnswer?.trim().toLowerCase();

    // Jika player jawab benar → tampilkan hijau
    if (isCorrect && isSelectedOption) {
      return "bg-green-600 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"
    }
    // Jika player jawab salah → tampilkan merah hanya yang dipilih, yang lain abu-abu (jangan reveal jawaban benar)
    if (!isCorrect && isSelectedOption) {
      return "bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
    }
    // Tombol lain tetap abu-abu (jangan highlight jawaban benar)
    return "bg-gray-700 border-gray-600 text-gray-400"
  }

  // === GANTI kondisi loading (ganti room → session) ===
  // Jangan paksa presence currentQuestion untuk show page; tampilkan placeholder soal jika belum ada.
  if (!session || !currentPlayer) {
    <LoadingScreen children={undefined} />
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div
        className={`absolute inset-0 transition-all duration-1000 ${dangerLevel === 3
          ? "bg-gradient-to-br from-red-900/40 via-black to-red-950/40"
          : dangerLevel === 2
            ? "bg-gradient-to-br from-red-950/25 via-black to-purple-950/25"
            : "bg-gradient-to-br from-red-950/15 via-black to-purple-950/15"
          }`}
        style={{
          opacity: 0.3 + pulseIntensity * 0.4,
          filter: `hue-rotate(${pulseIntensity * 30}deg)`,
        }}
      />

      {isClient && (timeLeft <= 30 || dangerLevel >= 2) && (
        <div className="absolute inset-0">
          {[...Array(Math.floor((pulseIntensity + dangerLevel) * 5))].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-red-500 rounded-full animate-ping opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1}s`,
                animationDuration: `${0.8 + Math.random() * 1}s`,
              }}
            />
          ))}
        </div>
      )}

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
                className={`text-4xl md:text-6xl font-bold font-mono tracking-wider transition-all duration-150 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse text-red-500`}
                style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
              >
                {t("title")}
              </h1>
            </motion.div>

          </div>

          {/* 1-BAR INFO ROW */}
          <div className="inline-flex items-center gap-x-5 md:gap-x-6 mx-auto px-4 py-2 mb-5 border border-red-500/30 rounded-full bg-black/40 font-mono text-xs md:text-sm">
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
                {formatTime(timeLeft)}
              </span>
            </div>
            <div className="flex items-center gap-x-1">
              {currentPlayer && [...Array(currentPlayer.health.max)].map((_, i) => (<Heart
                key={i}
                className={`w-4 h-4 transition-all ${i < playerHealth
                  ? playerHealth <= 1
                    ? "text-red-500 fill-red-500 animate-pulse"
                    : "text-green-500 fill-green-500"
                  : "text-gray-600 fill-gray-600"
                  }`}
              />
              ))}
            </div>
            <div className="flex items-center gap-x-1">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-white">{playerSpeed} km/h</span>
            </div>
          </div>

          <Card className="max-w-4xl mx-auto bg-gray-900/90 border-red-900/50 backdrop-blur-sm p-0">
            <div className="p-4 sm:p-6 md:p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-purple-500/5" />
              <div className="relative z-10">

                {/* GAMBAR (kalau ada) */}
                {currentQuestion?.image && (
                  <div className="mb-6 text-center">
                    <img
                      src={currentQuestion.image}
                      alt="Question visual"
                      className="max-w-full max-h-64 mx-auto rounded-xl shadow-2xl border-2 border-red-800/50"
                    />
                  </div>
                )}

                {/* PERTANYAAN */}
                <div className="mb-8 min-h-[6rem] flex items-center justify-center px-4">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white leading-relaxed text-center drop-shadow-lg">
                    {currentQuestion?.question || "Loading soal..."}
                  </h2>
                </div>

                {/* PILIHAN JAWABAN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {currentQuestion?.answers?.map((item: any, index: number) => {
                    const isSelectedOption = selectedAnswer === item.answer;
                    // Hanya highlight jawaban benar jika player menjawab benar
                    const shouldShowCorrect = isCorrect && isSelectedOption;

                    return (
                      <Button
                        key={index}
                        onClick={() => handleAnswerSelect(item.answer, index)}
                        disabled={isAnswered || isProcessingAnswer}
                        className={`
                          p-6 min-h-fit text-left justify-start font-mono text-base md:text-lg border-2 
                          transition-all duration-300 relative overflow-hidden group
                          ${isProcessingAnswer ? "opacity-50 cursor-not-allowed" : "hover:scale-105"}
                          ${!isAnswered
                            ? "bg-gray-800/90 border-gray-600 hover:border-purple-500 hover:bg-gray-700/90"
                            : shouldShowCorrect
                              ? "bg-green-600/80 border-green-500 shadow-[0_0_25px_rgba(34,197,94,0.6)]"
                              : isSelectedOption
                                ? "bg-red-600/80 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.6)]"
                                : "bg-gray-800/50 border-gray-700"
                          }
                        `}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                        <div className="flex items-center space-x-3 md:space-x-4 relative z-10 w-full">
                          <span className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center text-lg font-bold flex-shrink-0 mt-0.5">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1 text-left break-words whitespace-normal py-0.5">{item.answer}</span>

                          {/* Icon Benar - hanya muncul jika jawab benar */}
                          {isAnswered && shouldShowCorrect && (
                            <CheckCircle className="w-6 h-6 md:w-7 md:h-7 text-white animate-pulse flex-shrink-0 mt-0.5" />
                          )}

                          {/* Icon Salah - hanya muncul jika jawab salah */}
                          {isAnswered && isSelectedOption && !isCorrect && (
                            <XCircle className="w-6 h-6 md:w-7 md:h-7 text-white animate-pulse flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                      </Button>
                    );
                  })}

                  {/* Fallback kalau answers kosong */}
                  {!currentQuestion?.answers && (
                    <div className="col-span-2 text-center text-gray-500 py-10">
                      Menunggu soal...
                    </div>
                  )}
                </div>

              </div>
            </div>
          </Card>
        </div>
        <ZombieFeedback
          isCorrect={isCorrect}
          isVisible={showFeedback}
          activeZombie={session?.difficulty?.split(":")[0] || "zombie"}
          activePlayer={currentPlayer?.character_type ?? null}
        />
      </div>
    </div>
  )
}