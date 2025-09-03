"use client"

import { useState, useEffect, useRef } from "react"
import { AlertTriangle, CheckCircle, CircleQuestionMark, Clock, Heart, Skull, XCircle, Zap } from "lucide-react"
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

  const [roomInfo, setRoomInfo] = useState<{ game_start_time: string; duration: number; difficulty_level: string } | null>(null)
  const [gameStartTime, setGameStartTime] = useState<number | null>(null)
  const [playerJoinTime, setPlayerJoinTime] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [timeLoaded, setTimeLoaded] = useState(false)
  const [inactivityCountdown, setInactivityCountdown] = useState<number | null>(null)
  const [penaltyCountdown, setPenaltyCountdown] = useState<number | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(
    Math.min(resumeState?.currentIndex ?? 0, (room?.questions?.length ?? 1) - 1)
  )
  const [playerHealth, setPlayerHealth] = useState(resumeState?.health || 3)
  const [playerSpeed, setPlayerSpeed] = useState(resumeState?.speed || 20)
  const [correctAnswers, setCorrectAnswers] = useState(resumeState?.correctAnswers || 0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const questions = room?.questions || []
  const totalQuestions = questions.length
  const currentQuestion = questions[currentQuestionIndex]
  const pulseIntensity = timeLeft <= 30 ? (31 - timeLeft) / 30 : 0
  const FEEDBACK_DURATION = 1000

  // Definisikan pengaturan berdasarkan difficulty_level
  const difficultySettings = {
    easy: { inactivityPenalty: 30 },
    medium: { inactivityPenalty: 15 },
    hard: { inactivityPenalty: 10 },
  }
  const inactivityPenalty = roomInfo && ["easy", "medium", "hard"].includes(roomInfo.difficulty_level)
    ? difficultySettings[roomInfo.difficulty_level as keyof typeof difficultySettings].inactivityPenalty
    : difficultySettings.medium.inactivityPenalty // Default ke medium

  useEffect(() => {
    const fetchRoomInfo = async () => {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("game_start_time, duration, difficulty_level")
        .eq("id", room.id)
        .single()

      if (error) {
        console.error(t("log.fetchRoomInfoError", { error: error.message }))
        return
      }

      setRoomInfo(data)
      if (data.game_start_time) {
        const startTime = new Date(data.game_start_time).getTime()
        setGameStartTime(startTime)
        const { data: playerData, error: playerError } = await supabase
          .from("players")
          .select("joined_at")
          .eq("id", currentPlayer.id)
          .single()

        if (playerError) {
          console.error(t("log.fetchPlayerError", { error: playerError.message }))
          return
        }

        if (playerData?.joined_at) {
          setPlayerJoinTime(new Date(playerData.joined_at).getTime())
        }
      }
    }

    if (room?.id) {
      fetchRoomInfo()
    }
  }, [room?.id, currentPlayer?.id, t])

  useEffect(() => {
    if (!roomInfo?.game_start_time || !roomInfo.duration) return

    const start = new Date(roomInfo.game_start_time).getTime()
    const updateTimeLeft = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - start) / 1000)
      const remaining = Math.max(0, roomInfo.duration - elapsed)
      setTimeLeft(remaining)
      setTimeLoaded(true)
    }

    updateTimeLeft()
    const interval = setInterval(updateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [roomInfo])

  useEffect(() => {
    const initializeLastAnswerTime = async () => {
      if (!room?.id || !currentPlayer?.id) return

      const { data, error } = await supabase
        .from("player_health_states")
        .select("last_answer_time")
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)
        .single()

      if (error || !data?.last_answer_time) {
        await supabase.from("player_health_states").upsert({
          player_id: currentPlayer.id,
          room_id: room.id,
          health: playerHealth,
          speed: playerSpeed,
          last_answer_time: new Date().toISOString(),
        })
      }
    }

    initializeLastAnswerTime()
  }, [room?.id, currentPlayer?.id, playerHealth, playerSpeed])

  useEffect(() => {
    const fetchAnsweredProgress = async () => {
      if (!room?.id || !currentPlayer?.id) return

      const { data, error } = await supabase
        .from("player_answers")
        .select("question_index, answer, is_correct")
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)
        .order("question_index", { ascending: true })

      if (error) {
        console.error(t("log.fetchAnsweredProgressError", { error: error.message }))
        return
      }

      if (data && data.length > 0) {
        const lastIndex = data[data.length - 1].question_index
        setCurrentQuestionIndex(lastIndex + 1)
        setCorrectAnswers(data.filter((d) => d.is_correct).length)
      }
    }

    fetchAnsweredProgress()
  }, [room?.id, currentPlayer?.id, t])

  const getDangerLevel = () => {
    if (playerHealth <= 1) return 3
    if (playerHealth <= 2) return 2
    return 1
  }

  const dangerLevel = getDangerLevel()

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
      const completionTime = new Date().toISOString()

      console.log(t("log.saveGameCompletion", {
        nickname: currentPlayer.nickname,
        health: finalHealth,
        correct: finalCorrect,
        eliminated: actuallyEliminated,
        completion_type: actuallyEliminated ? "eliminated" : "completed"
      }))

      const { data, error } = await supabase.from("game_completions").upsert({
        player_id: currentPlayer.id,
        room_id: room.id,
        final_health: Math.max(0, finalHealth),
        correct_answers: finalCorrect,
        total_questions_answered: totalAnswered,
        is_eliminated: actuallyEliminated,
        completion_type: actuallyEliminated ? "eliminated" : "completed",
        completed_at: completionTime,
        survival_duration: survivalDuration
      })

      if (error) {
        console.error(t("log.saveGameCompletionError", { error: error.message }))
      } else {
        console.log(t("log.saveGameCompletionSuccess", { data }))
      }
    } catch (error) {
      console.error(t("log.saveGameCompletionError", { error }))
    }
  }

  const saveAnswerAndUpdateHealth = async (answer: string, isCorrectAnswer: boolean) => {
    try {
      setIsProcessingAnswer(true)

      let newSpeed = playerSpeed
      if (isCorrectAnswer) {
        newSpeed = Math.min(playerSpeed + 5, 100)
      } else {
        newSpeed = Math.max(20, playerSpeed - 5)
      }

      const { error: answerError } = await supabase.from("player_answers").insert({
        player_id: currentPlayer.id,
        room_id: room.id,
        question_index: currentQuestionIndex,
        answer: answer,
        is_correct: isCorrectAnswer,
        speed: newSpeed,
      })

      if (answerError) {
        console.error(t("log.saveAnswerError", { error: answerError.message }))
        return false
      }

      await supabase
        .from("player_health_states")
        .update({ speed: newSpeed, health: playerHealth, last_answer_time: new Date().toISOString() })
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)

      setPlayerSpeed(newSpeed)
      console.log(t("log.playerSpeedAfterAnswer", { newSpeed }))

      return true
    } catch (error) {
      console.error(t("log.saveAnswerAndUpdateHealthError", { error }))
      return false
    } finally {
      setIsProcessingAnswer(false)
    }
  }

  const syncHealthAndSpeedFromDatabase = async () => {
    if (!room?.id || !currentPlayer?.id) {
      console.log(t("log.skipSync"))
      return
    }
    try {
      const { data, error } = await supabase.rpc("get_player_health", {
        p_player_id: currentPlayer.id,
        p_room_id: room.id,
      })

      if (error) {
        console.error(t("log.getPlayerHealthError", { error: error.message }))
        return
      }

      if (data !== null && data !== playerHealth) {
        console.log(t("log.syncHealth", { oldHealth: playerHealth, newHealth: data }))
        setPlayerHealth(data)
      }

      const { data: speedData, error: speedError } = await supabase
        .from("player_health_states")
        .select("speed, last_answer_time")
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)
        .single()

      if (speedError) {
        console.error(t("log.getPlayerSpeedError", { error: speedError.message }))
        return
      }

      if (speedData && speedData.speed !== playerSpeed) {
        console.log(t("log.syncSpeed", { oldSpeed: playerSpeed, newSpeed: speedData.speed }))
        setPlayerSpeed(speedData.speed)
      }
    } catch (error) {
      console.error(t("log.syncHealthAndSpeedError", { error }))
    }
  }

  const checkInactivityPenalty = async () => {
    if (!room?.id || !currentPlayer?.id || playerHealth <= 0 || isProcessingAnswer || isAnswered) {
      console.log(t("log.skipInactivityCheck"))
      setInactivityCountdown(null)
      setPenaltyCountdown(null)
      return
    }
    try {
      const { data, error } = await supabase
        .from("player_health_states")
        .select("last_answer_time, speed")
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)
        .single()

      if (error) {
        console.error(t("log.inactivityCheckError", { error: error.message }))
        setInactivityCountdown(null)
        setPenaltyCountdown(null)
        return
      }

      if (!data.last_answer_time) {
        console.log(t("log.noLastAnswerTime"))
        await supabase
          .from("player_health_states")
          .update({ last_answer_time: new Date().toISOString() })
          .eq("player_id", currentPlayer.id)
          .eq("room_id", room.id)
        setInactivityCountdown(null)
        setPenaltyCountdown(null)
        return
      }

      const lastAnswerTime = new Date(data.last_answer_time).getTime()
      const currentTime = Date.now()
      const timeSinceLastAnswer = (currentTime - lastAnswerTime) / 1000

      console.log(t("log.inactivityCheck", { timeSinceLastAnswer, speed: data.speed }))

      const warningThreshold = inactivityPenalty - 10 // Peringatan 10 detik sebelum penalti
      if (timeSinceLastAnswer >= warningThreshold && timeSinceLastAnswer < inactivityPenalty && data.speed > 20) {
        const countdown = Math.ceil(inactivityPenalty - timeSinceLastAnswer)
        console.log(t("log.startPenaltyCountdown", { countdown }))
        setInactivityCountdown(null)
        setPenaltyCountdown(countdown)
      } else if (timeSinceLastAnswer >= inactivityPenalty && data.speed > 20) {
        const newSpeed = Math.max(20, data.speed - 10)
        console.log(t("log.applyInactivityPenalty", { timeSinceLastAnswer, oldSpeed: data.speed, newSpeed }))
        await supabase
          .from("player_health_states")
          .update({ speed: newSpeed, last_answer_time: new Date().toISOString() })
          .eq("player_id", currentPlayer.id)
          .eq("room_id", room.id)
        setPlayerSpeed(newSpeed)
        setInactivityCountdown(null)
        setPenaltyCountdown(null)
      } else {
        if (inactivityCountdown !== null || penaltyCountdown !== null) {
          console.log(t("log.clearCountdowns"))
          setInactivityCountdown(null)
          setPenaltyCountdown(null)
        }
      }
    } catch (error) {
      console.error(t("log.inactivityCheckError", { error }))
      setInactivityCountdown(null)
      setPenaltyCountdown(null)
    }
  }

  const redirectToResults = async (
    health: number,
    correct: number,
    total: number,
    isEliminated = false,
    isPerfect = false,
  ) => {
    const actuallyEliminated = isEliminated || health <= 0

    console.log(t("log.redirectToResults", {
      health,
      correct,
      total,
      eliminated: actuallyEliminated,
      perfect: isPerfect
    }))

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    try {
      await saveGameCompletion(health, correct, total, actuallyEliminated)
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.error(t("log.redirectToResultsError", { error }))
    }

    const lastResult = {
      playerId: currentPlayer.id,
      roomCode: roomCode,
      nickname: currentPlayer.nickname,
      health: Math.max(0, health),
      correct: correct,
      total: total,
      eliminated: actuallyEliminated,
      timestamp: Date.now(),
    }

    localStorage.setItem("lastGameResult", JSON.stringify(lastResult))
    localStorage.setItem(`gameResult_${roomCode}_${currentPlayer.id}`, JSON.stringify(lastResult))

    if (onGameComplete) onGameComplete(lastResult)

    router.push(`/game/${roomCode}/results`)
  }

  useEffect(() => {
    if (!timeLoaded || timeLeft > 0) return
    if (isProcessingAnswer) return
    if (timeLeft === 0 && !isProcessingAnswer) {
      redirectToResults(playerHealth, correctAnswers, currentQuestionIndex + 1, true)
    }
  }, [timeLeft, isProcessingAnswer, playerHealth, correctAnswers, currentQuestionIndex, timeLoaded])

  useEffect(() => {
    if (onProgressUpdate) {
      onProgressUpdate({
        health: playerHealth,
        correctAnswers,
        currentIndex: currentQuestionIndex,
      })
    }
  }, [playerHealth, correctAnswers, currentQuestionIndex, onProgressUpdate])

  useEffect(() => {
    syncHealthAndSpeedFromDatabase()
    const syncInterval = setInterval(syncHealthAndSpeedFromDatabase, 2000)
    return () => clearInterval(syncInterval)
  }, [currentPlayer.id, room.id])

  useEffect(() => {
    const penaltyInterval = setInterval(checkInactivityPenalty, 1000)
    return () => clearInterval(penaltyInterval)
  }, [currentPlayer.id, room.id, playerHealth, isProcessingAnswer, isAnswered])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (playerHealth <= 0) {
      console.log(t("log.playerEliminated"))
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setShowFeedback(false)
      redirectToResults(0, correctAnswers, currentQuestionIndex + 1, true)
    }
  }, [playerHealth, correctAnswers, currentQuestionIndex])

  useEffect(() => {
    if (showFeedback) {
      const feedbackTimer = setTimeout(() => {
        setShowFeedback(false)
        if (playerHealth <= 0) {
          console.log(t("log.eliminatedDuringFeedback"))
          redirectToResults(0, correctAnswers, currentQuestionIndex + 1, true)
        } else if (currentQuestionIndex + 1 >= totalQuestions) {
          console.log(t("log.allQuestionsAnswered"))
          redirectToResults(playerHealth, correctAnswers, totalQuestions, false, correctAnswers === totalQuestions)
        } else {
          nextQuestion()
        }
      }, FEEDBACK_DURATION)
      return () => clearTimeout(feedbackTimer)
    }
  }, [showFeedback, playerHealth, correctAnswers, currentQuestionIndex, isCorrect, totalQuestions])

  const nextQuestion = () => {
    setCurrentQuestionIndex(prevIndex => prevIndex + 1)
    setSelectedAnswer(null)
    setIsAnswered(false)
    setIsCorrect(null)
  }

  const handleAnswerSelect = async (answer: string) => {
    if (isAnswered || !currentQuestion || isProcessingAnswer) return

    const { data: existing, error } = await supabase
      .from("player_answers")
      .select("id")
      .eq("player_id", currentPlayer.id)
      .eq("room_id", room.id)
      .eq("question_index", currentQuestionIndex)
      .maybeSingle()

    if (existing) {
      console.log(t("log.alreadyAnswered"))
      return
    }

    setSelectedAnswer(answer)
    setIsAnswered(true)
    setInactivityCountdown(null)
    setPenaltyCountdown(null)

    if (answer === currentQuestion.correct_answer) {
      await handleCorrectAnswer()
    } else {
      await handleWrongAnswer()
    }
  }

  const handleCorrectAnswer = async () => {
    if (isProcessingAnswer) return

    setCorrectAnswers(prevCorrectAnswers => prevCorrectAnswers + 1)
    setIsCorrect(true)
    setShowFeedback(true)

    await saveAnswerAndUpdateHealth(selectedAnswer || "", true)
  }

  const handleWrongAnswer = async () => {
    if (isProcessingAnswer) return

    setIsCorrect(false)
    setShowFeedback(true)

    await saveAnswerAndUpdateHealth(selectedAnswer || "TIME_UP", false)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`
  }

  const getAnswerButtonClass = (option: string) => {
    if (!isAnswered) {
      return "bg-gray-800 border-gray-600 text-white"
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
      <div
        className={`absolute inset-0 transition-all duration-1000 ${
          dangerLevel === 3
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
            <Skull className="w-8 h-8 text-red-500 mr-3 animate-pulse" />
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
            <Skull className="w-8 h-8 text-red-500 ml-3 animate-pulse" />
          </div>

          {/* Peringatan Penalti Ketidakaktifan */}
          {penaltyCountdown !== null && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-4 text-red-500 font-mono text-sm md:text-base animate-pulse"
            >
              {t("inactivityWarning", { countdown: penaltyCountdown })}
            </motion.div>
          )}

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
              {[...Array(3)].map((_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 transition-all ${
                    i < playerHealth
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
        <ZombieFeedback isCorrect={isCorrect} isVisible={showFeedback} />
      </div>
    </div>
  )
}