"use client"

import { useState, useEffect, useRef } from "react"
import { AlertTriangle, CheckCircle, Clock, Skull, XCircle, Zap } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AnimatePresence, motion } from "framer-motion"
import { Progress } from "../ui/progress"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import ZombieFeedback from "./ZombieFeedback"
import { useTranslation } from "react-i18next"

interface QuizPhaseProps {
  room: any
  gameState: any
  currentPlayer: any
  players: any[]
  gameLogic: any
  isSoloMode: boolean
  wrongAnswers: number
  resumeState?: {
    health: number
    correctAnswers: number
    currentIndex: number
    speed?: number
    isResuming: boolean
  }
  onGameComplete?: (result: any) => void
  onProgressUpdate?: (progress: { health: number; correctAnswers: number; currentIndex: number }) => void
}

export default function QuizPhase({
  room,
  gameState,
  currentPlayer,
  players,
  gameLogic,
  isSoloMode,
  wrongAnswers,
  resumeState,
  onGameComplete,
  onProgressUpdate,
}: QuizPhaseProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const roomCode = params.roomCode as string

  const [roomInfo, setRoomInfo] = useState<{ game_start_time: string; duration: number } | null>(null)
  const [gameStartTime, setGameStartTime] = useState<number | null>(null)
  const [playerJoinTime, setPlayerJoinTime] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isClient, setIsClient] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(resumeState?.currentIndex || 0)
  const [playerHealth, setPlayerHealth] = useState(resumeState?.health || 3)
  const [playerSpeed, setPlayerSpeed] = useState(resumeState?.speed || 20)
  const [correctAnswers, setCorrectAnswers] = useState(resumeState?.correctAnswers || 0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const questions = room?.questions || []
  const totalQuestions = questions.length
  const currentQuestion = questions[currentQuestionIndex]
  const FEEDBACK_DURATION = 1000

  // Initialize room info and player join time
  useEffect(() => {
    const fetchRoomInfo = async () => {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("game_start_time, duration")
        .eq("id", room.id)
        .single()

      if (error) {
        console.error("❌ Gagal fetch room info:", error.message)
        return
      }
      setRoomInfo(data)
      if (data.game_start_time) {
        const startTime = new Date(data.game_start_time).getTime()
        setGameStartTime(startTime)
        const { data: playerData } = await supabase
          .from("players")
          .select("joined_at")
          .eq("id", currentPlayer.id)
          .single()

        if (playerData?.joined_at) {
          setPlayerJoinTime(new Date(playerData.joined_at).getTime())
        }
      }
    }

    if (room?.id) {
      fetchRoomInfo()
    }
  }, [room?.id, currentPlayer?.id])

  // Handle game timer
  useEffect(() => {
    if (!roomInfo?.game_start_time || !roomInfo.duration) return

    const start = new Date(roomInfo.game_start_time).getTime()
    const updateTimer = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - start) / 1000)
      const remaining = Math.max(0, roomInfo.duration - elapsed)
      setTimeLeft(remaining)
      if (remaining <= 0) {
        redirectToResults(playerHealth, correctAnswers, currentQuestionIndex + 1)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [roomInfo])

  // Initialize player health state
  useEffect(() => {
    const initializeHealthState = async () => {
      if (!room?.id || !currentPlayer?.id) return

      const { data, error } = await supabase
        .from("player_health_states")
        .select("health, speed, last_answer_time")
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)
        .single()

      if (error && error.code !== "PGRST116") {
        console.error("❌ Gagal menginisialisasi health state:", error.message)
        return
      }
      if (!data) {
        await supabase.from("player_health_states").upsert({
          player_id: currentPlayer.id,
          room_id: room.id,
          health: playerHealth,
          speed: playerSpeed,
          last_answer_time: new Date().toISOString(),
        })
      } else {
        setPlayerHealth(data.health)
        setPlayerSpeed(data.speed)
      }
    }

    initializeHealthState()
  }, [room?.id, currentPlayer?.id])

  // Fetch answered progress
  useEffect(() => {
    const fetchAnsweredProgress = async () => {
      if (!room?.id || !currentPlayer?.id) return

      const { data, error } = await supabase
        .from("player_answers")
        .select("question_index, is_correct")
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)
        .order("question_index", { ascending: true })

      if (error) {
        console.error("Gagal mengambil progress jawaban:", error)
        return
      }

      if (data && data.length > 0) {
        const lastIndex = data[data.length - 1].question_index
        setCurrentQuestionIndex(lastIndex + 1)
        setCorrectAnswers(data.filter((d) => d.is_correct).length)
      }
    }

    fetchAnsweredProgress()
  }, [room?.id, currentPlayer?.id])

  // Real-time subscription for health and speed
  useEffect(() => {
    if (!room?.id || !currentPlayer?.id) return

    const channel = supabase
      .channel(`health-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "player_health_states",
          filter: `player_id=eq.${currentPlayer.id}`,
        },
        (payload) => {
          const newState = payload.new
          setPlayerHealth(newState.health)
          setPlayerSpeed(newState.speed)
          if (newState.health <= 0) {
            redirectToResults(0, correctAnswers, currentQuestionIndex + 1, true)
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room?.id, currentPlayer?.id])

  // Check Supabase connection
  useEffect(() => {
    const checkConnection = () => {
      const state = supabase.getChannels()[0]?.state || "closed"
      setIsConnected(state === "joined")
    }

    checkConnection()
    const interval = setInterval(checkConnection, 5000)
    return () => clearInterval(interval)
  }, [])

  const calculateSurvivalDuration = () => {
    if (!gameStartTime || !playerJoinTime) return 0
    const effectiveStartTime = Math.max(gameStartTime, playerJoinTime)
    return Math.floor((Date.now() - effectiveStartTime) / 1000)
  }

  const saveGameCompletion = async (
    finalHealth: number,
    finalCorrect: number,
    totalAnswered: number,
    isEliminated = false,
  ) => {
    try {
      const actuallyEliminated = isEliminated || finalHealth <= 0
      const survivalDuration = calculateSurvivalDuration()

      const { error } = await supabase.from("game_completions").insert({
        player_id: currentPlayer.id,
        room_id: room.id,
        final_health: Math.max(0, finalHealth),
        correct_answers: finalCorrect,
        total_questions_answered: totalAnswered,
        is_eliminated: actuallyEliminated,
        completion_type: actuallyEliminated ? "eliminated" : finalCorrect === totalQuestions ? "completed" : "partial",
        completed_at: new Date().toISOString(),
        survival_duration: survivalDuration,
      })

      if (error) {
        console.error("Gagal menyimpan penyelesaian permainan:", error)
      }
    } catch (error) {
      console.error("Error di saveGameCompletion:", error)
    }
  }

  const saveAnswerAndUpdateHealth = async (answer: string, isCorrectAnswer: boolean) => {
    try {
      setIsProcessingAnswer(true)

      // Hanya update speed, tidak mengubah health atau countdown
      const newSpeed = isCorrectAnswer ? Math.min(playerSpeed + 5, 100) : Math.max(20, playerSpeed - 5)

      const { error } = await supabase.from("player_answers").insert({
        player_id: currentPlayer.id,
        room_id: room.id,
        question_index: currentQuestionIndex,
        answer,
        is_correct: isCorrectAnswer,
        speed: newSpeed,
      })

      if (error) {
        console.error("Gagal menyimpan jawaban:", error)
        return false
      }

      // Update hanya speed dan last_answer_time di player_health_states
      await supabase
        .from("player_health_states")
        .update({
          speed: newSpeed,
          last_answer_time: new Date().toISOString(),
        })
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)

      setPlayerSpeed(newSpeed)
      // Tidak mengubah playerHealth di sini karena health dikelola oleh HostGamePage

      return true
    } catch (error) {
      console.error("Error di saveAnswerAndUpdateHealth:", error)
      return false
    } finally {
      setIsProcessingAnswer(false)
    }
  }

  const redirectToResults = async (
    health: number,
    correct: number,
    total: number,
    isEliminated = false,
  ) => {
    const actuallyEliminated = isEliminated || health <= 0
    await saveGameCompletion(health, correct, total, actuallyEliminated)

    const lastResult = {
      playerId: currentPlayer.id,
      roomCode,
      nickname: currentPlayer.nickname,
      health: Math.max(0, health),
      correct,
      total,
      eliminated: actuallyEliminated,
      timestamp: Date.now(),
    }

    localStorage.setItem("lastGameResult", JSON.stringify(lastResult))
    localStorage.setItem(`gameResult_${roomCode}_${currentPlayer.id}`, JSON.stringify(lastResult))

    if (onGameComplete) onGameComplete(lastResult)

    router.push(`/game/${roomCode}/results`)
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (onProgressUpdate) {
      onProgressUpdate({
        health: playerHealth,
        correctAnswers,
        currentIndex: currentQuestionIndex,
      })
    }
  }, [playerHealth, correctAnswers, currentQuestionIndex])

  const handleAnswerSelect = async (answer: string) => {
    if (isAnswered || !currentQuestion || isProcessingAnswer || !isConnected) return

    const { data: existing } = await supabase
      .from("player_answers")
      .select("id")
      .eq("player_id", currentPlayer.id)
      .eq("room_id", room.id)
      .eq("question_index", currentQuestionIndex)
      .maybeSingle()

    if (existing) {
      console.log("Sudah pernah dijawab, skip")
      return
    }

    setSelectedAnswer(answer)
    setIsAnswered(true)

    const isCorrectAnswer = answer === currentQuestion.correct_answer
    setIsCorrect(isCorrectAnswer)
    setShowFeedback(true)

    if (isCorrectAnswer) {
      setCorrectAnswers(correctAnswers + 1)
    }

    const success = await saveAnswerAndUpdateHealth(answer, isCorrectAnswer)

    if (!success) {
      setIsAnswered(false)
      setSelectedAnswer(null)
      setShowFeedback(false)
      return
    }

    setTimeout(() => {
      setShowFeedback(false)
      if (currentQuestionIndex + 1 >= totalQuestions) {
        supabase
          .from("game_rooms")
          .update({
            current_phase: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", room.id)
        redirectToResults(playerHealth, correctAnswers + (isCorrectAnswer ? 1 : 0), totalQuestions)
      } else {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
        setSelectedAnswer(null)
        setIsAnswered(false)
        setIsCorrect(null)
      }
    }, FEEDBACK_DURATION)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`
  }

  const getAnswerButtonClass = (option: string) => {
    if (!isAnswered) {
      return "bg-gray-800 hover:bg-gray-700 border-gray-600 text-white"
    }
    if (option === currentQuestion?.correct_answer) {
      return "bg-green-600 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"
    }
    if (option === selectedAnswer && option !== currentQuestion?.correct_answer) {
      return "bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
    }
    return "bg-gray-700 border-gray-600 text-gray-400"
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Skull className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
          <p className="text-white font-mono text-xl">{t("loadingQuestion")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {!isConnected && (
        <div className="fixed top-4 right-4 bg-red-600 text-white p-2 rounded animate-pulse">
          {t("connectionLost")}
        </div>
      )}
      <div
        className={`absolute inset-0 transition-all duration-1000 ${
          playerHealth <= 1
            ? "bg-gradient-to-br from-red-900/40 via-black to-red-950/40"
            : playerHealth <= 2
            ? "bg-gradient-to-br from-red-950/25 via-black to-purple-950/25"
            : "bg-gradient-to-br from-red-950/15 via-black to-purple-950/15"
        }`}
        style={{
          opacity: 0.3 + (timeLeft <= 30 ? (31 - timeLeft) / 30 : 0) * 0.4,
        }}
      />
      <div className="relative z-10 container mx-auto px-4 py-8 pb-24">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <Skull className="w-8 h-8 text-red-500 mr-3 animate-pulse" />
            <h1 className="text-3xl font-bold text-white font-mono tracking-wider">{t("examTitle")}</h1>
            <Skull className="w-8 h-8 text-red-500 ml-3 animate-pulse" />
          </div>
          <div className="max-w-md mx-auto mb-4">
            <div className="flex items-center justify-center space-x-4 mb-2">
              <span className="text-white font-mono text-lg">
                {t("questionCounter", {
                  current: currentQuestionIndex + 1,
                  total: totalQuestions,
                })}
              </span>
              <span className="text-white font-mono">{formatTime(timeLeft)}</span>
            </div>
            <Progress value={((currentQuestionIndex + 1) / totalQuestions) * 100} className="h-2 bg-gray-800" />
          </div>
          <div className="flex items-center justify-center space-x-4 mb-4">
            <span className="text-white font-mono">{t("health")}:</span>
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full border-2 ${
                    i < playerHealth
                      ? playerHealth <= 1
                        ? "bg-red-500 border-red-400 animate-pulse"
                        : "bg-green-500 border-green-400"
                      : "bg-gray-600 border-gray-500"
                  }`}
                />
              ))}
            </div>
            <span className="text-white font-mono">{t("speed")}: {playerSpeed}</span>
            <span className="text-gray-400 font-mono text-sm">{t("correct")}: {correctAnswers}</span>
            {isProcessingAnswer && (
              <span className="text-yellow-400 font-mono text-xs animate-pulse">{t("processing")}</span>
            )}
          </div>
        </div>
        <Card className="max-w-4xl mx-auto mb-8 bg-gray-900/90 border-red-900/50 backdrop-blur-sm">
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
                <Zap className="w-8 h-8 text-purple-500 animate-pulse flex-shrink-0 mt-1" />
                <h2 className="text-2xl font-bold text-white leading-relaxed">{currentQuestion.question_text}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option: string, index: number) => (
                  <Button
                    key={index}
                    onClick={() => handleAnswerSelect(option)}
                    disabled={isAnswered || isProcessingAnswer || !isConnected}
                    className={`${getAnswerButtonClass(option)} p-6 text-left justify-start font-mono text-lg border-2 transition-all duration-300 relative overflow-hidden group`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <div className="flex items-center space-x-3 relative z-10">
                      <span className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-sm font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                      {isAnswered && option === currentQuestion.correct_answer && (
                        <CheckCircle className="w-5 h-5 ml-auto animate-pulse" />
                      )}
                      {isAnswered && option === selectedAnswer && option !== currentQuestion.correct_answer && (
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
      <ZombieFeedback isCorrect={isCorrect} isVisible={showFeedback} />
    </div>
  )
}