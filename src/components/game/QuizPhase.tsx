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
  const router = useRouter()
  const params = useParams()
  const roomCode = params.roomCode as string

  const [roomInfo, setRoomInfo] = useState<{ game_start_time: string; duration: number } | null>(null)
  const [gameStartTime, setGameStartTime] = useState<number | null>(null)
  const [playerJoinTime, setPlayerJoinTime] = useState<number | null>(null)

  useEffect(() => {
    const fetchRoomInfo = async () => {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("game_start_time, duration")
        .eq("id", room.id)
        .single()

      if (error) {
        console.error("❌ Gagal fetch room info:", error.message)
      } else {
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
    }

    if (room?.id) {
      fetchRoomInfo()
    }
  }, [room?.id, currentPlayer?.id])

  const [timeLeft, setTimeLeft] = useState(0)
  useEffect(() => {
    if (!roomInfo?.game_start_time || !roomInfo.duration) return

    const start = new Date(roomInfo.game_start_time).getTime()
    const now = Date.now()
    const elapsed = Math.floor((now - start) / 1000)
    const remaining = Math.max(0, roomInfo.duration - elapsed)

    setTimeLeft(remaining)

    const interval = setInterval(() => {
      const now = Date.now()
      const newElapsed = Math.floor((now - start) / 1000)
      const newRemaining = Math.max(0, roomInfo.duration - newElapsed)
      setTimeLeft(newRemaining)
    }, 1000)

    return () => clearInterval(interval)
  }, [roomInfo])

  const [inactivityCountdown, setInactivityCountdown] = useState<number | null>(null)
  const [penaltyCountdown, setPenaltyCountdown] = useState<number | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

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

      console.log(
        `[v0] Saving game completion - Health: ${finalHealth}, Eliminated: ${actuallyEliminated}, Duration: ${survivalDuration}s`,
      )

      const { data, error } = await supabase.from("game_completions").upsert({
        player_id: currentPlayer.id,
        room_id: room.id,
        final_health: Math.max(0, finalHealth),
        correct_answers: finalCorrect,
        total_questions_answered: totalAnswered,
        is_eliminated: actuallyEliminated,
        completion_type: actuallyEliminated ? "eliminated" : "completed" ,
        completed_at: completionTime,
        survival_duration: survivalDuration,
        game_start_time: gameStartTime ? new Date(gameStartTime).toISOString() : null,
        player_join_time: playerJoinTime ? new Date(playerJoinTime).toISOString() : null,
      })

      if (error) {
        console.error("Gagal menyimpan penyelesaian permainan:", error)
      } else {
        console.log(
          `Penyelesaian permainan berhasil disimpan - Health: ${finalHealth}, Eliminated: ${actuallyEliminated}, Duration: ${survivalDuration}s`,
        )
      }
    } catch (error) {
      console.error("Error di saveGameCompletion:", error)
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
        console.error("Gagal menyimpan jawaban:", answerError)
        return false
      }

      await supabase
        .from("player_health_states")
        .update({ speed: newSpeed, health: playerHealth, last_answer_time: new Date().toISOString() })
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)

      setPlayerSpeed(newSpeed)

      console.log("player speed after jawab:", newSpeed)

      return true
    } catch (error) {
      console.error("Error di saveAnswerAndUpdateHealth:", error)
      return false
    } finally {
      setIsProcessingAnswer(false)
    }
  }

  const syncHealthAndSpeedFromDatabase = async () => {
    if (!room?.id || !currentPlayer?.id) {
      console.log("⚠️ room or currentPlayer is null, skipping sync")
      return
    }
    try {
      const { data, error } = await supabase.rpc("get_player_health", {
        p_player_id: currentPlayer.id,
        p_room_id: room.id,
      })

      if (error) {
        console.error("Gagal mendapatkan kesehatan pemain:", error)
        return
      }

      if (data !== null && data !== playerHealth) {
        console.log(`Kesehatan disinkronkan dari ${playerHealth} ke ${data}`)
        setPlayerHealth(data)
      }

      const { data: speedData, error: speedError } = await supabase
        .from("player_health_states")
        .select("speed, last_answer_time")
        .eq("player_id", currentPlayer.id)
        .eq("room_id", room.id)
        .single()

      if (speedError) {
        console.error("Gagal mendapatkan kecepatan pemain:", speedError)
        return
      }

      if (speedData && speedData.speed !== playerSpeed) {
        console.log(`Kecepatan disinkronkan dari ${playerSpeed} ke ${speedData.speed}`)
        setPlayerSpeed(speedData.speed)
      }
    } catch (error) {
      console.error("Error saat sinkronisasi kesehatan dan kecepatan:", error)
    }
  }

  useEffect(() => {
    if (onProgressUpdate) {
      onProgressUpdate({
        health: playerHealth,
        correctAnswers,
        currentIndex: currentQuestionIndex,
      })
    }
  }, [playerHealth, correctAnswers, currentQuestionIndex])

  const checkInactivityPenalty = async () => {
    if (!room?.id || !currentPlayer?.id || playerHealth <= 0 || isProcessingAnswer || isAnswered) {
      console.log(
        "⚠️ Skipping inactivity penalty check: invalid room, player, eliminated, processing answer, or already answered",
      )
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
        console.error("Gagal memeriksa ketidakaktifan:", error)
        setInactivityCountdown(null)
        setPenaltyCountdown(null)
        return
      }

      if (!data.last_answer_time) {
        console.log("No last_answer_time, initializing...")
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

      console.log(`🕒 Pemeriksaan ketidakaktifan: timeSinceLastAnswer=${timeSinceLastAnswer}s, speed=${data.speed}`)

      if (timeSinceLastAnswer >= 15 && timeSinceLastAnswer < 25 && data.speed > 20) {
        const countdown = Math.ceil(25 - timeSinceLastAnswer)
        console.log(`⏲️ Memulai countdown penalti: ${countdown}s`)
        setInactivityCountdown(null)
        setPenaltyCountdown(countdown)
      } else if (timeSinceLastAnswer >= 25 && data.speed > 20) {
        const newSpeed = Math.max(20, data.speed - 10)
        console.log(
          `⚠️ Pemain tidak aktif selama ${timeSinceLastAnswer}s, kecepatan dikurangi dari ${data.speed} ke ${newSpeed}`,
        )
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
          console.log("🔄 Menghapus semua countdown karena pemain aktif atau kecepatan <= 20")
          setInactivityCountdown(null)
          setPenaltyCountdown(null)
        }
      }
    } catch (error) {
      console.error("Error di checkInactivityPenalty:", error)
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

    console.log(
      `Mengalihkan ke hasil: health=${health}, correct=${correct}, total=${total}, eliminated=${actuallyEliminated}, perfect=${isPerfect}`,
    )

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    try {
      await saveGameCompletion(health, correct, total, actuallyEliminated)

      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.error("Error saving game completion:", error)
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
      console.log("[v0] Player eliminated (health <= 0), stopping all timers and redirecting")
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
          console.log("Pemain tereliminasi selama feedback, mengalihkan ke hasil")
          redirectToResults(0, correctAnswers, currentQuestionIndex + 1, true)
        } else if (currentQuestionIndex + 1 >= totalQuestions) {
          console.log("Semua pertanyaan dijawab, mengalihkan ke hasil")
          const finalCorrect = correctAnswers
          redirectToResults(playerHealth, finalCorrect, totalQuestions, false, finalCorrect === totalQuestions)
        } else {
          nextQuestion()
        }
      }, FEEDBACK_DURATION)
      return () => clearTimeout(feedbackTimer)
    }
  }, [showFeedback, playerHealth, correctAnswers, currentQuestionIndex, isCorrect, totalQuestions])

  const nextQuestion = () => {
    setCurrentQuestionIndex(currentQuestionIndex + 1)
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
      console.log("Sudah pernah dijawab, skip")
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

    const newCorrectAnswers = correctAnswers + 1
    setCorrectAnswers(newCorrectAnswers)
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
      return "bg-gray-800 border-gray-600  text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
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
          <p className="text-white font-mono text-xl">Memuat pertanyaan...</p>
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
{/* 
      <AnimatePresence>
        {penaltyCountdown !== null && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-900/90 text-white font-mono text-lg px-6 py-3 rounded-lg shadow-lg border border-red-500/50 animate-pulse"
          >
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-300 animate-bounce" />
              <span>Penalty countdown: {penaltyCountdown}s</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence> */}

      <div className="relative z-10 container mx-auto px-4 py-8 pb-24">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <Skull className="w-8 h-8 text-red-500 mr-3 animate-pulse" />
            <h1 className="text-3xl font-bold text-white font-mono tracking-wider">UJIAN KEGELAPAN</h1>
            <Skull className="w-8 h-8 text-red-500 ml-3 animate-pulse" />
          </div>

          <div className="max-w-md mx-auto mb-4">
            <div className="flex items-center justify-center space-x-4 mb-2">
              <span className="text-white font-mono text-lg">
                Pertanyaan {currentQuestionIndex + 1} dari {totalQuestions}
              </span>
            </div>
            <Progress value={((currentQuestionIndex + 1) / totalQuestions) * 100} className="h-2 bg-gray-800" />
          </div>

          <div className="max-w-md mx-auto mb-6">
            <div className="flex items-center justify-center space-x-4 mb-3">
              <Clock className={`w-6 h-6 ${timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-yellow-500"}`} />
              <span
                className={`text-2xl font-mono font-bold ${timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-white"}`}
              >
                {formatTime(timeLeft)}
              </span>
              {timeLeft <= 15 && <AlertTriangle className="w-6 h-6 text-red-500 animate-bounce" />}
            </div>
            <Progress value={(timeLeft / 300) * 100} className="h-3 bg-gray-800" />
          </div>

          <div className="flex items-center justify-center space-x-4 mb-4">
            <span className="text-white font-mono">Nyawa:</span>
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                    i < playerHealth
                      ? playerHealth <= 1
                        ? "bg-red-500 border-red-400 animate-pulse"
                        : "bg-green-500 border-green-400"
                      : "bg-gray-600 border-gray-500"
                  }`}
                />
              ))}
            </div>
            <span className="text-white font-mono">Kecepatan: {playerSpeed}</span>
            <span className="text-gray-400 font-mono text-sm">Benar: {correctAnswers}</span>
            {isProcessingAnswer && (
              <span className="text-yellow-400 font-mono text-xs animate-pulse">Memproses...</span>
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