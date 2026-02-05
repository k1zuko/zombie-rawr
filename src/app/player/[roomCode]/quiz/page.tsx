"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { CircleQuestionMark, Clock, Heart, XCircle, Zap, CheckCircle } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { mysupa } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import ZombieFeedback from "@/components/game/ZombieFeedback"
import toast from "react-hot-toast"
import LoadingScreen from "@/components/LoadingScreen"
import { generateXID } from "@/lib/id-generator"
import Image from "next/image"
import { calculateCountdown } from "@/lib/server-time"
import { AnimatePresence, motion } from "framer-motion"

export interface Session {
  id: string
  game_pin: string
  quiz_id: string
  status: "waiting" | "active" | "finished"
  question_limit: number
  total_time_minutes: number
  difficulty: string
  current_questions: any[]
  host_id: string | null
  created_at: string
  started_at: string | null
  countdown_started_at?: string | null
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
  }
  is_alive: boolean
  joined_at: string
  answers: any[]
  finished_at: string | null
  completion?: boolean
}

export default function QuizPage() {
  const router = useRouter()
  const params = useParams()
  const gamePin = params.roomCode as string

  const isMountedRef = useRef(true)
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [session, setSession] = useState<Session | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Participant | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [timeLoaded, setTimeLoaded] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [playerHealth, setPlayerHealth] = useState(100)
  const [playerSpeed, setPlayerSpeed] = useState(1)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  // Derived state for question index - STRICTLY derived from data
  const realIndex = currentPlayer?.answers?.length || 0

  // VISUAL state determines what user sees (delayed until feedback is gone)
  const [visualIndex, setVisualIndex] = useState(realIndex)

  // Sync visual index with real index, BUT hold it while feedback is showing
  useEffect(() => {
    if (!showFeedback && visualIndex !== realIndex) {
      setVisualIndex(realIndex)
    }
  }, [realIndex, showFeedback, visualIndex])

  const questions = session?.current_questions ?? []
  const totalQuestions = session?.question_limit ?? questions.length ?? 0
  const currentQuestion = questions[visualIndex] ?? null

  const pulseIntensity = timeLeft <= 30 ? (31 - timeLeft) / 30 : 0
  const FEEDBACK_DURATION = 1400

  // ── LOAD DATA AWAL ───────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      if (!gamePin) return router.replace("/")

      const prefetch = localStorage.getItem("quizPrefetchData")
      if (prefetch) {
        try {
          const { session: s, currentPlayer: p } = JSON.parse(prefetch)
          if (s.game_pin !== gamePin || !p?.id) throw new Error("Invalid prefetch")

          // If started_at is missing, fetch fresh session for correct timer
          let sessionToUse = s
          if (!s.started_at) {
            const { data: freshSess } = await mysupa
              .from("sessions")
              .select("started_at, total_time_minutes, countdown_started_at, status")
              .eq("game_pin", gamePin)
              .single()
            if (freshSess) {
              sessionToUse = { ...s, ...freshSess }
            }
          }

          setSession(sessionToUse)
          setCurrentPlayer(p)
          setPlayerHealth(p.health.current)
          setPlayerSpeed(p.health.speed || 1)
          setCorrectAnswers(p.correct_answers || 0)

          // Initial sync
          setVisualIndex(p.answers?.length || 0)

          localStorage.setItem("playerId", p.id)
          localStorage.removeItem("quizPrefetchData")
          setIsClient(true)
          return
        } catch {
          localStorage.removeItem("quizPrefetchData")
        }
      }

      try {
        const { data: sess, error: e1 } = await mysupa
          .from("sessions")
          .select("*")
          .eq("game_pin", gamePin)
          .single()
        if (e1 || !sess) throw new Error("Session not found")
        setSession(sess)

        const pid = localStorage.getItem("playerId")
        if (!pid) throw new Error("No player ID")

        const { data: player, error: e2 } = await mysupa
          .from("participants")
          .select("*")
          .eq("id", pid)
          .single()
        if (e2 || !player) throw new Error("Player not found")

        setCurrentPlayer(player)
        setPlayerHealth(player.health.current)
        setPlayerSpeed(player.health.speed || 1)
        setCorrectAnswers(player.correct_answers || 0)

        // Initial sync
        setVisualIndex(player.answers?.length || 0)

        setIsClient(true)
      } catch (err) {
        console.error(err)
        toast.error("Gagal memuat game")
        router.replace("/")
      }
    }

    loadData()
  }, [gamePin, router])

  // ── COUNTDOWN LOGIC ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.countdown_started_at || session?.status === "active") {
      setCountdown(null)
      return
    }

    const update = () => {
      const remaining = calculateCountdown(session.countdown_started_at!, 10000)
      setCountdown(remaining)
      if (remaining <= 0) {
        setCountdown(null)
        // Optimistic update
        setSession(prev => prev ? ({ ...prev, status: "active", started_at: new Date().toISOString() }) : null)
      }
    }

    update()
    const timer = setInterval(update, 100)
    return () => clearInterval(timer)
  }, [session?.countdown_started_at, session?.status])

  // ── REALTIME + POLLING ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.id || !currentPlayer?.id) return

    let poll: NodeJS.Timeout | null = null

    const updateFromServer = async () => {
      if (showFeedback || isProcessingAnswer) return

      try {
        const { data } = await mysupa
          .from("participants")
          .select("*")
          .eq("id", currentPlayer.id)
          .single()
        if (!data) return

        // 1. ALWAYS Sync Stats (Health, Speed, Score) - Source of Truth is Server
        setPlayerHealth(data.health.current)
        setPlayerSpeed(data.health.speed || 1)
        setCorrectAnswers(data.correct_answers || 0)
        setCurrentPlayer(data)
        // Real index updates automatically via currentPlayer

        // 3. Check Elimination
        if (data.health.current <= 0 || !data.is_alive) {
          redirectToResults(0, data.correct_answers || 0, totalQuestions, true)
        }
      } catch { }
    }

    // Listen for participant updates
    const playerChannel = mysupa
      .channel(`player:${currentPlayer.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participants", filter: `id=eq.${currentPlayer.id}` },
        (payload) => {
          if (payload.eventType !== "UPDATE") return
          const upd = payload.new as Participant

          if (showFeedback || isProcessingAnswer) return

          // 1. ALWAYS Sync Stats (Health, Speed, Score)
          setPlayerHealth(upd.health.current)
          setPlayerSpeed(upd.health.speed || 1)
          setCorrectAnswers(upd.correct_answers || 0)
          setCurrentPlayer(upd)

          // 3. Check Elimination
          if (upd.health.current <= 0 || !upd.is_alive) {
            redirectToResults(0, upd.correct_answers || 0, totalQuestions, true)
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && isMountedRef.current) {
          poll = setInterval(updateFromServer, 5000)
        }
      })

    // Listen for session status changes (when host ends game)
    const sessionChannel = mysupa
      .channel(`session:${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const updSession = payload.new as Session
          setSession(updSession) // Fix: Always update session state (for timer/status)

          if (updSession.status === "finished") {
            // Host ended the game, redirect to results
            redirectToResults(playerHealth, correctAnswers, totalQuestions, playerHealth <= 0)
          }
        }
      )
      .subscribe()

    return () => {
      console.log("Cleaning up quiz page effect")
      // Do NOT set isMountedRef.current = false here, as it breaks re-runs!
      if (poll) clearInterval(poll)
      mysupa.removeChannel(playerChannel)
      mysupa.removeChannel(sessionChannel)
    }
  }, [session?.id, currentPlayer?.id, isAnswered, showFeedback, isProcessingAnswer, totalQuestions, playerHealth, correctAnswers])

  // ── TIMER ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.started_at) return

    const start = new Date(session.started_at).getTime()
    const durationMs = (session.total_time_minutes || 10) * 60 * 1000

    const update = () => {
      const left = Math.max(0, Math.floor((start + durationMs - Date.now()) / 1000))
      setTimeLeft(left)
      if (!timeLoaded) setTimeLoaded(true)
    }

    update()
    const i = setInterval(update, 1000)
    return () => clearInterval(i)
  }, [session?.started_at, session?.total_time_minutes, timeLoaded])

  useEffect(() => {
    if (timeLoaded && timeLeft <= 0 && !isProcessingAnswer && !showFeedback) {
      redirectToResults(playerHealth, correctAnswers, totalQuestions, true)
    }
  }, [timeLeft, timeLoaded, isProcessingAnswer, showFeedback])

  // ── FEEDBACK → NEXT ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showFeedback) return

    const t = setTimeout(() => {
      setShowFeedback(false)
      setIsAnswered(false)
      setSelectedAnswer(null)
      setIsCorrect(null)

      // Use robust index logic (sync with server/optimistic data)
      const nextIdx = currentPlayer?.answers?.length || 0

      // Check for completion
      if (playerHealth <= 0) {
        redirectToResults(0, correctAnswers, totalQuestions, true)
        return
      }

      if (nextIdx >= totalQuestions) {
        redirectToResults(playerHealth, correctAnswers, totalQuestions, false)
        return
      }

      // No need to set index manually anymore! It's derived.
      // BUT we do need to update Visual Index now that feedback is done
      setVisualIndex(nextIdx)
    }, FEEDBACK_DURATION)

    return () => clearTimeout(t)
  }, [showFeedback, currentPlayer, playerHealth, correctAnswers, totalQuestions])

  const submitAnswer = useCallback(async (answer: string, correct: boolean) => {
    if (!currentPlayer || !currentQuestion || isProcessingAnswer) return

    setIsProcessingAnswer(true)

    try {
      const entry = {
        id: generateXID(),
        correct,
        answer_id: currentQuestion.answers.findIndex((a: any) => a.answer === answer).toString(),
        question_id: currentQuestion.id,
      }

      const answersNew = [...(currentPlayer.answers || []), entry]
      const newHealth = correct ? playerHealth : Math.max(0, playerHealth - 1)
      const newSpeed = Math.max(20, (playerSpeed || 20) + (correct ? 5 : -5))
      const newCorrect = answersNew.filter(a => a.correct).length
      const scorePerQ = totalQuestions > 0 ? Math.floor(100 / totalQuestions) : 100
      const newScore = newCorrect * scorePerQ

      const { error } = await mysupa.from("participants").update({
        answers: answersNew,
        correct_answers: newCorrect,
        score: newScore,
        health: { ...currentPlayer.health, current: newHealth, speed: newSpeed },
      }).eq("id", currentPlayer.id)

      if (error) throw error

      setPlayerHealth(newHealth)
      setPlayerSpeed(newSpeed)
      setCorrectAnswers(newCorrect)
      setCurrentPlayer(p => p ? {
        ...p,
        answers: answersNew,
        correct_answers: newCorrect,
        score: newScore,
        health: { ...p.health, current: newHealth, speed: newSpeed },
      } : null)

      setIsCorrect(correct)
      setShowFeedback(true)
    } catch (err) {
      console.error(err)
      toast.error("Gagal simpan jawaban")
      setIsAnswered(false)
    } finally {
      setIsProcessingAnswer(false)
    }
  }, [currentPlayer, currentQuestion, playerHealth, playerSpeed, totalQuestions, isProcessingAnswer])

  const handleAnswer = (ans: string, idx: number) => {
    if (isAnswered || isProcessingAnswer || !currentQuestion) return
    setSelectedAnswer(ans)
    setIsAnswered(true)
    submitAnswer(ans, idx.toString() === currentQuestion.correct)
  }

  const redirectToResults = async (health: number, correct: number, total: number, eliminated: boolean) => {
    if (!currentPlayer || !session) return

    await mysupa.from("participants").update({
      finished_at: new Date().toISOString(),
      completion: true,
      health: { ...currentPlayer.health, current: Math.max(0, health) },
      is_alive: health > 0,
    }).eq("id", currentPlayer.id)

    localStorage.setItem("lastGameResult", JSON.stringify({
      playerId: currentPlayer.id,
      gamePin,
      nickname: currentPlayer.nickname,
      character: currentPlayer.character_type,
      finalHealth: Math.max(0, health),
      correctAnswers: correct,
      totalQuestions: total,
      survivalSeconds: Math.floor((Date.now() - new Date(session.started_at!).getTime()) / 1000),
      eliminated,
      timestamp: Date.now(),
    }))

    router.push(`/player/${gamePin}/result`)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const ss = s % 60
    return `${m}:${ss < 10 ? "0" : ""}${ss}`
  }

  // If session/player not loaded OR visualIndex says we are done (but redirect pending), show Loading
  // NOTE: If countdown is active, we render specific countdown UI, so we bypass strict loading check
  const isLoading = !session || !currentPlayer || !isClient || (visualIndex >= totalQuestions && !countdown)

  if (isLoading && !countdown) return <LoadingScreen children={undefined} />

  const danger = playerHealth <= 25 ? 3 : playerHealth <= 50 ? 2 : 1

  return (
    <div className="min-h-screen bg-black text-white relative overflow-y-auto">
      {/* Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black flex items-center justify-center z-[100]"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="text-[12rem] font-bold text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]"
            >
              {countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110] p-4"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-full max-h-full"
            >
              <Image
                src={zoomedImage}
                alt="Gambar diperbesar"
                width={1200}
                height={900}
                className="rounded-lg max-h-[70vh] max-w-[70vw] object-contain"
                unoptimized
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background effect */}
      <div
        className={`absolute inset-0 transition-all duration-1000 ${danger === 3 ? "bg-gradient-to-br from-red-950/60 to-black" :
          danger === 2 ? "bg-gradient-to-br from-red-950/40 to-purple-950/30" :
            "bg-gradient-to-br from-red-950/20 to-purple-950/20"
          }`}
        style={{ opacity: 0.35 + pulseIntensity * 0.45 }}
      />

      {/* Logo Mobile - hanya QuizRush di tengah */}
      <div className="md:hidden flex justify-center pt-2 pb-2">
        <Image
          src="/logo/quizrush.png"
          alt="QuizRush Logo"
          width={200}
          height={50}
          className="h-auto w-36 sm:w-48"
          priority
          unoptimized
        />
      </div>

      {/* Logo Desktop/Tablet - kiri dan kanan */}
      <div className="hidden md:block">
        <div className="absolute top-5 left-6 lg:left-10 z-50">
          <Image
            src="/logo/quizrush.png"
            alt="QuizRush Logo"
            width={260}
            height={65}
            className="h-auto w-44 lg:w-60"
            priority
            unoptimized
          />
        </div>
        <div className="absolute top-5 right-6 lg:right-10 z-50">
          <Image
            src="/logo/gameforsmartlogo-horror.png"
            alt="GameForSmart Logo"
            width={260}
            height={65}
            className="h-auto w-44 lg:w-60"
            priority
            unoptimized
          />
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-3 pt-2 md:pt-24 pb-6">
        {/* Info Bar - dipaksa 1 baris */}
        {/* Info Bar - Tengah horizontal di semua ukuran, terutama desktop */}
        <div className="flex justify-center mb-3 sm:mb-5">
          <div className="inline-flex items-center gap-x-5 md:gap-x-6 px-4 py-2 border border-red-500/30 rounded-full bg-black/40 text-xs md:text-sm backdrop-blur-sm">
            <div className="flex items-center gap-x-1">
              <CircleQuestionMark className="w-4 h-4 text-purple-400" />
              <span className="text-white">
                {visualIndex + 1}/{totalQuestions}
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
              {currentPlayer && [...Array(currentPlayer.health.max)].map((_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 transition-all ${i < playerHealth
                    ? playerHealth <= 25
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
        </div>

        <Card className="max-w-3xl mx-auto bg-gray-900/85 border-red-900/50 backdrop-blur-md shadow-xl shadow-black/50 p-6">
          <div>
            {/* Pertanyaan */}
            <div className="mb-3 sm:mb-6 flex flex-col items-center justify-center px-1">
              {/* Gambar pertanyaan (jika ada) */}
              {currentQuestion?.image && (
                <div className="mb-2 sm:mb-4 w-full flex justify-center">
                  <Image
                    src={currentQuestion.image}
                    alt="Gambar pertanyaan"
                    width={400}
                    height={300}
                    className="rounded-lg max-h-[120px] sm:max-h-[200px] md:max-h-[300px] w-auto object-contain border border-gray-700/50 shadow-lg cursor-pointer hover:opacity-90 hover:scale-[1.02] transition-all"
                    unoptimized
                    onClick={() => setZoomedImage(currentQuestion.image)}
                  />
                </div>
              )}
              <p className="text-base sm:text-xl md:text-2xl lg:text-3xl text-left leading-tight break-words whitespace-pre-wrap mx-auto drop-shadow-lg max-h-[200px] md:max-h-[300px] overflow-y-auto">
                {currentQuestion?.question ?? "Menunggu soal berikutnya..."}
              </p>
            </div>

            {/* Jawaban */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 md:gap-6">
              {currentQuestion?.answers?.map((item: any, idx: number) => {
                const selected = selectedAnswer === item.answer
                const showCorrect = isAnswered && selected && isCorrect === true
                const showWrong = isAnswered && selected && isCorrect === false

                return (
                  <Button
                    key={idx}
                    variant="outline"
                    disabled={isAnswered || isProcessingAnswer}
                    onClick={() => handleAnswer(item.answer, idx)}
                    className={`
                      h-auto 
                      p-3 sm:p-4 md:p-5 text-left items-center 
                      border-2 transition-all duration-300 relative overflow-hidden group
                      ${isProcessingAnswer ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.02]"}
                      ${!isAnswered
                        ? "bg-gray-800/90 border-gray-700 hover:bg-gray-700/90 hover:border-purple-600"
                        : showCorrect
                          ? "bg-green-900/70 border-green-600 shadow-lg shadow-green-900/40"
                          : showWrong
                            ? "bg-red-900/70 border-red-600 shadow-lg shadow-red-900/40"
                            : "bg-gray-800/60 border-gray-700 opacity-70"
                      }
                    `}
                  >
                    <div className={`flex w-full ${item.image ? 'flex-col items-center gap-2' : 'flex-row items-center gap-2 sm:gap-3'}`}>
                      {/* Label huruf (A, B, C, D) */}
                      <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-current flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0 ${item.image ? 'absolute top-2 left-2 bg-gray-900/80 z-10' : ''}`}>
                        {String.fromCharCode(65 + idx)}
                      </div>

                      {/* Gambar jawaban (jika ada) */}
                      {item.image ? (
                        <div className="w-full flex justify-center py-2">
                          <Image
                            src={item.image}
                            alt={`Jawaban ${String.fromCharCode(65 + idx)}`}
                            width={200}
                            height={150}
                            className="rounded-lg max-h-[100px] sm:max-h-[120px] md:max-h-[150px] w-auto object-contain hover:opacity-80 transition-opacity cursor-pointer"
                            unoptimized
                            onClick={(e) => {
                              e.stopPropagation()
                              setZoomedImage(item.image)
                            }}
                          />
                        </div>
                      ) : null}

                      {/* Teks jawaban - hanya tampilkan jika bukan placeholder */}
                      {(!item.image || (item.answer && item.answer !== ".")) && (
                        <span className="flex-1 text-sm sm:text-base md:text-lg leading-relaxed break-words whitespace-pre-wrap">
                          {item.answer}
                        </span>
                      )}

                      {/* Ikon feedback */}
                      {showCorrect && <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-green-300 absolute top-2 right-2" />}
                      {showWrong && <XCircle className="w-6 h-6 sm:w-7 sm:h-7 text-red-300 absolute top-2 right-2" />}
                    </div>
                  </Button>
                )
              })}
            </div>
          </div>
        </Card>

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