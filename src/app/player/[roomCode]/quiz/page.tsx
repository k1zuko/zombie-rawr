"use client"

import { useState, useEffect, useRef } from "react"
import { AlertTriangle, CheckCircle, CircleQuestionMark, Clock, Heart, Skull, XCircle, Zap } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AnimatePresence, motion } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import ZombieFeedback from "@/components/game/ZombieFeedback"
import { useTranslation } from "react-i18next"
import { useGameLogic } from "@/hooks/useGameLogic" // Import useGameLogic
import toast from "react-hot-toast"

// Define types for GameRoom and EmbeddedPlayer if not already imported from supabase
interface GameRoom {
  id: string
  room_code: string
  host_id: string | null
  title: string
  status: "waiting" | "playing" | "finished"
  max_players: number
  duration: number
  quiz_id: string | null
  chaser_type: "zombie" | "monster1" | "monster2" | "monster3" | "darknight"
  difficulty_level: "easy" | "medium" | "hard"
  created_at: string
  updated_at: string
  game_start_time: string | null
  countdown_start: string | null
  question_count: number
  embedded_questions: any[]
  players: EmbeddedPlayer[]
  quiz?: { questions: any[] } // Add quiz property for direct access if needed
}

interface EmbeddedPlayer {
  player_id: string;
  nickname: string;
  character_type: string;
  score: number;
  correct_answers: number;
  is_host: boolean;
  position_x: number;
  position_y: number;
  is_alive: boolean;
  power_ups: number;
  joined_at: string;
  health: {
    current: number;
    max: number;
    is_being_attacked: boolean;
    last_attack_time: string;
    speed: number;
    last_answer_time: string;
    countdown: number;
  };
  answers: any[];
  attacks: any[];
}

export default function QuizPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const roomCode = params.roomCode as string

  const [room, setRoom] = useState<GameRoom | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<EmbeddedPlayer | null>(null)
  const [roomInfo, setRoomInfo] = useState<{ game_start_time: string; duration: number; difficulty_level: string; embedded_questions: any[]; players: any[] } | null>(null)
  const [gameStartTime, setGameStartTime] = useState<number | null>(null)
  const [playerJoinTime, setPlayerJoinTime] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [timeLoaded, setTimeLoaded] = useState(false)
  const [inactivityCountdown, setInactivityCountdown] = useState<number | null>(null)
  const [penaltyCountdown, setPenaltyCountdown] = useState<number | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0) // Initialized safely
  const [playerHealth, setPlayerHealth] = useState(3)
  const [playerSpeed, setPlayerSpeed] = useState(20)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const gameLogicHookResult = useGameLogic({ room, players: room?.players || [], currentPlayer });

  const {
    isSubmitting,
    submitAnswer: gameLogicSubmitAnswer,
    nextQuestion: gameLogicNextQuestion,
  } = gameLogicHookResult;

  // Ambil questions dari embedded_questions atau quiz.questions
  const questions = roomInfo?.embedded_questions && roomInfo.embedded_questions.length > 0
    ? roomInfo.embedded_questions
    : room?.quiz?.questions || []
  const totalQuestions = questions.length
  const currentQuestion = questions[currentQuestionIndex]
  const pulseIntensity = timeLeft <= 30 ? (31 - timeLeft) / 30 : 0
  const FEEDBACK_DURATION = 1000

  // Definisikan pengaturan berdasarkan difficulty_level
  const difficultySettings = {
    easy: { inactivityPenalty: 45 },
    medium: { inactivityPenalty: 30 },
    hard: { inactivityPenalty: 20 },
  }
  const inactivityPenalty = roomInfo && ["easy", "medium", "hard"].includes(roomInfo.difficulty_level)
    ? difficultySettings[roomInfo.difficulty_level as keyof typeof difficultySettings].inactivityPenalty
    : difficultySettings.medium.inactivityPenalty // Default ke medium

  // Initial data fetching for room and current player
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!roomCode) {
        router.replace("/");
        return;
      }

      const { data: roomData, error: roomError } = await supabase
        .from("game_rooms")
        .select(`
          *,
          quiz:quiz_id (questions)
        `)
        .eq("room_code", roomCode)
        .single();

      if (roomError || !roomData) {
        console.error("Error fetching room:", roomError);
        toast.error("Room tidak ditemukan!");
        router.replace("/");
        return;
      }
      setRoom(roomData);
      setRoomInfo(roomData); // Also set roomInfo for consistency

      const playerId = localStorage.getItem("playerId");
      if (playerId) {
        const player = roomData.players?.find((p: EmbeddedPlayer) => p.player_id === playerId) || null;
        setCurrentPlayer(player);
      } else {
        console.error("Player ID not found in localStorage. Cannot identify current player.");
        toast.error("Tidak dapat mengidentifikasi pemain. Silakan bergabung kembali.");
        router.replace("/");
      }
    };

    fetchInitialData();
  }, [roomCode, router]);

  useEffect(() => {
    const fetchRoomInfo = async () => {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("game_start_time, duration, difficulty_level, embedded_questions, players")
        .eq("id", room?.id) // Use optional chaining
        .single()

      if (error) {
        console.error(t("log.fetchRoomInfoError", { error: error.message }))
        return
      }

      setRoomInfo(data)
      if (data.game_start_time) {
        const startTime = new Date(data.game_start_time).getTime()
        setGameStartTime(startTime)
        
        // Cari player data dari room.players JSONB
        const playerData = data.players?.find((p: any) => p.player_id === currentPlayer?.player_id) // Use optional chaining
        if (playerData?.joined_at) {
          setPlayerJoinTime(new Date(playerData.joined_at).getTime())
        }
        
        // Sync health, speed, correctAnswers, currentIndex dari player data jika ada
        if (playerData) {
          setPlayerHealth(playerData.health?.current || 3)
          setPlayerSpeed(playerData.health?.speed || 20)
          setCorrectAnswers(playerData.correct_answers || 0)
          setCurrentQuestionIndex(playerData.current_index || 0)
        }
      }
    }

    if (room?.id && currentPlayer?.player_id) {
      fetchRoomInfo()
    }
  }, [room?.id, currentPlayer?.player_id, t])

  useEffect(() => {
    if (room && roomInfo) {
      const questions = roomInfo.embedded_questions && roomInfo.embedded_questions.length > 0
        ? roomInfo.embedded_questions
        : room.quiz?.questions || []
      const totalQuestions = questions.length
      const initialIndex = Math.min(0, (totalQuestions > 0 ? totalQuestions : 1) - 1) // resumeState is not available here
      setCurrentQuestionIndex(initialIndex)
    }
  }, [room, roomInfo]) // Removed resumeState from dependencies as it's not a prop anymore

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
    const initializePlayerState = async () => {
      if (!room?.id || !currentPlayer?.player_id) return

      // Cek apakah player sudah ada di room.players
      const { data: roomData, error } = await supabase
        .from("game_rooms")
        .select("players")
        .eq("id", room.id)
        .single()

      if (error) {
        console.error("Error fetching room:", error)
        return
      }

      const currentPlayers = roomData?.players || []
      const existingPlayerIndex = currentPlayers.findIndex((p: any) => p.player_id === currentPlayer.player_id)
      
      if (existingPlayerIndex === -1) {
        // Tambah player baru
        const newPlayer = {
          player_id: currentPlayer.player_id,
          nickname: currentPlayer.nickname,
          character_type: currentPlayer.character_type,
          joined_at: new Date().toISOString(),
          health: { current: playerHealth, max: 3, is_being_attacked: false, last_attack_time: new Date().toISOString(), speed: playerSpeed, last_answer_time: new Date().toISOString(), countdown: 0 },
          speed: playerSpeed,
          correct_answers: 0,
          current_index: 0,
          answers: [],
          last_answer_time: new Date().toISOString(),
        }
        const updatedPlayers = [...currentPlayers, newPlayer]
        await supabase
          .from("game_rooms")
          .update({ players: updatedPlayers })
          .eq("id", room.id)
      } else {
        // Update last_answer_time jika belum ada
        const updatedPlayers = [...currentPlayers]
        if (!updatedPlayers[existingPlayerIndex].health.last_answer_time) {
          updatedPlayers[existingPlayerIndex].health.last_answer_time = new Date().toISOString()
          await supabase
            .from("game_rooms")
            .update({ players: updatedPlayers })
            .eq("id", room.id)
        }
      }
    }

    initializePlayerState()
  }, [room?.id, currentPlayer?.player_id, playerHealth, playerSpeed])

  useEffect(() => {
    const fetchAnsweredProgress = async () => {
      if (!room?.id || !currentPlayer?.player_id) return

      const { data: roomData, error } = await supabase
        .from("game_rooms")
        .select("players")
        .eq("id", room.id)
        .single()

      if (error) {
        console.error(t("log.fetchAnsweredProgressError", { error: error.message }))
        return
      }

      const playerData = roomData?.players?.find((p: any) => p.player_id === currentPlayer.player_id)
      if (playerData && playerData.answers && playerData.answers.length > 0) {
        const lastIndex = playerData.answers[playerData.answers.length - 1].question_index
        setCurrentQuestionIndex(lastIndex + 1)
        setCorrectAnswers(playerData.correct_answers || 0)
      }
    }

    fetchAnsweredProgress()
  }, [room?.id, currentPlayer?.player_id, t])

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
    if (!room || !currentPlayer) {
      console.error("Room or currentPlayer is null, cannot save game completion.");
      return;
    }
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
        player_id: currentPlayer.player_id,
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

  const saveAnswerAndUpdatePlayerState = async (answer: string, isCorrectAnswer: boolean, newHealth?: number) => {
    if (!room || !currentPlayer) {
      console.error("Room or currentPlayer is null, cannot save answer and update player state.");
      return false;
    }
    const currentRoom = room; // Type: GameRoom
    const player = currentPlayer; // Type: EmbeddedPlayer

    try {
      setIsProcessingAnswer(true)

      let newSpeed = playerSpeed
      if (isCorrectAnswer) {
        newSpeed = Math.min(playerSpeed + 5, 100)
      } else {
        newSpeed = Math.max(20, playerSpeed - 5)
      }

      const { data: roomData, error: roomError } = await supabase
        .from("game_rooms")
        .select("players")
        .eq("id", currentRoom.id)
        .single()

      if (roomError) {
        console.error("Error fetching room for answer save:", roomError)
        return false
      }

      const currentPlayers = roomData?.players || []
      const playerIndex = currentPlayers.findIndex((p: any) => p.player_id === player.player_id)
      if (playerIndex === -1) {
        console.error("Player not found in room")
        return false
      }

      const newAnswer = {
        question_index: currentQuestionIndex,
        answer: answer,
        is_correct: isCorrectAnswer,
        speed: newSpeed,
        answered_at: new Date().toISOString(),
      }

      const updatedPlayer = {
        ...currentPlayers[playerIndex],
        health: {
          ...currentPlayers[playerIndex].health,
          current: newHealth !== undefined ? newHealth : currentPlayers[playerIndex].health.current, // Update health.current
          speed: newSpeed
        },
        answers: [...(currentPlayers[playerIndex].answers || []), newAnswer],
        correct_answers: isCorrectAnswer
          ? (currentPlayers[playerIndex].correct_answers || 0) + 1
          : (currentPlayers[playerIndex].correct_answers || 0),
        last_answer_time: new Date().toISOString(),
      }

      const updatedPlayers = [...currentPlayers]
      updatedPlayers[playerIndex] = updatedPlayer

      const { error: updateError } = await supabase
        .from("game_rooms")
        .update({ players: updatedPlayers })
        .eq("id", currentRoom.id)

      if (updateError) {
        console.error(t("log.saveAnswerError", { error: updateError.message }))
        return false
      }

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

  const syncPlayerStateFromDatabase = async () => {
    if (!room?.id || !currentPlayer?.player_id) {
      console.log(t("log.skipSync"))
      return
    }
    try {
      const { data: roomData, error } = await supabase
        .from("game_rooms")
        .select("players")
        .eq("id", room.id)
        .single()

      if (error) {
        console.error("Error syncing player state:", error)
        return
      }

      const playerData = roomData?.players?.find((p: any) => p.player_id === currentPlayer.player_id)
      if (!playerData) return

      if (playerData.health?.current !== undefined && playerData.health.current !== playerHealth) {
        console.log(t("log.syncHealth", { oldHealth: playerHealth, newHealth: playerData.health.current }))
        setPlayerHealth(playerData.health.current)
      }

      if (playerData.health?.speed !== undefined && playerData.health.speed !== playerSpeed) {
        console.log(t("log.syncSpeed", { oldSpeed: playerSpeed, newSpeed: playerData.health.speed }))
        setPlayerSpeed(playerData.health.speed)
      }

      if (playerData.correct_answers !== undefined && playerData.correct_answers !== correctAnswers) {
        setCorrectAnswers(playerData.correct_answers)
      }

      if (playerData.current_index !== undefined && playerData.current_index !== currentQuestionIndex) {
        setCurrentQuestionIndex(playerData.current_index)
      }
    } catch (error) {
      console.error(t("log.syncHealthAndSpeedError", { error }))
    }
  }

  const checkInactivityPenalty = async () => {
    if (!room?.id || !currentPlayer?.player_id || playerHealth <= 0 || isProcessingAnswer || isAnswered) {
      console.log(t("log.skipInactivityCheck"))
      setInactivityCountdown(null)
      setPenaltyCountdown(null)
      return
    }
    try {
      const { data: roomData, error } = await supabase
        .from("game_rooms")
        .select("players")
        .eq("id", room.id)
        .single()

      if (error) {
        console.error(t("log.inactivityCheckError", { error: error.message }))
        setInactivityCountdown(null)
        setPenaltyCountdown(null)
        return
      }

      const currentPlayers = roomData?.players || []
      const playerData = currentPlayers.find((p: any) => p.player_id === currentPlayer.player_id)
      if (!playerData?.health?.last_answer_time) {
        console.log(t("log.noLastAnswerTime"))
        // Update last_answer_time
        const playerIndex = currentPlayers.findIndex((p: any) => p.player_id === currentPlayer.player_id)
        if (playerIndex !== -1) {
          currentPlayers[playerIndex].health.last_answer_time = new Date().toISOString()
          await supabase
            .from("game_rooms")
            .update({ players: currentPlayers })
            .eq("id", room.id)
        }
        setInactivityCountdown(null)
        setPenaltyCountdown(null)
        return
      }

      const lastAnswerTime = new Date(playerData.health.last_answer_time).getTime()
      const currentTime = Date.now()
      const timeSinceLastAnswer = (currentTime - lastAnswerTime) / 1000

      console.log(t("log.inactivityCheck", { timeSinceLastAnswer, speed: playerData.health.speed }))

      const warningThreshold = inactivityPenalty - 10 // Peringatan 10 detik sebelum penalti
      if (timeSinceLastAnswer >= warningThreshold && timeSinceLastAnswer < inactivityPenalty && playerData.health.speed > 20) {
        const countdown = Math.ceil(inactivityPenalty - timeSinceLastAnswer)
        console.log(t("log.startPenaltyCountdown", { countdown }))
        setInactivityCountdown(null)
        setPenaltyCountdown(null)
      } else if (timeSinceLastAnswer >= inactivityPenalty && playerData.health.speed > 20) {
        const newSpeed = Math.max(20, playerData.health.speed - 10)
        console.log(t("log.applyInactivityPenalty", { timeSinceLastAnswer, oldSpeed: playerData.health.speed, newSpeed }))
        // Update speed dan last_answer_time
        const playerIndex = currentPlayers.findIndex((p: any) => p.player_id === currentPlayer.player_id)
        if (playerIndex !== -1) {
          currentPlayers[playerIndex].health.speed = newSpeed
          currentPlayers[playerIndex].health.last_answer_time = new Date().toISOString()
          await supabase
            .from("game_rooms")
            .update({ players: currentPlayers })
            .eq("id", room.id)
        }
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
    if (!currentPlayer) {
      console.error("currentPlayer is null, cannot redirect to results.");
      return;
    }
    const actuallyEliminated = isEliminated || health <= 0

    console.log(t("log.redirectToResults", {
      nickname: currentPlayer.nickname,
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
      playerId: currentPlayer.player_id, // Changed from currentPlayer.id to currentPlayer.player_id
      roomCode: roomCode,
      nickname: currentPlayer.nickname,
      health: Math.max(0, health),
      correct: correct,
      total: total,
      eliminated: actuallyEliminated,
      timestamp: Date.now(),
    }

    localStorage.setItem("lastGameResult", JSON.stringify(lastResult))
    localStorage.setItem(`gameResult_${roomCode}_${currentPlayer.player_id}`, JSON.stringify(lastResult)) // Changed from currentPlayer.id to currentPlayer.player_id

    // onGameComplete is not a prop anymore
    // if (onGameComplete) onGameComplete(lastResult)

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
    // onProgressUpdate is not a prop anymore, so this can be removed or adapted
    // if (onProgressUpdate) {
    //   onProgressUpdate({
    //     health: playerHealth,
    //     correctAnswers,
    //     currentIndex: currentQuestionIndex,
    //   })
    // }
  }, [playerHealth, correctAnswers, currentQuestionIndex])

  useEffect(() => {
    syncPlayerStateFromDatabase()
    const syncInterval = setInterval(syncPlayerStateFromDatabase, 2000)
    return () => clearInterval(syncInterval)
  }, [currentPlayer?.player_id, room?.id])

  useEffect(() => {
    const penaltyInterval = setInterval(checkInactivityPenalty, 1000)
    return () => clearInterval(penaltyInterval)
  }, [currentPlayer?.player_id, room?.id, playerHealth, isProcessingAnswer, isAnswered])

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
      const feedbackTimer = setTimeout(async () => {
        setShowFeedback(false)
        if (playerHealth <= 0) {
          console.log(t("log.eliminatedDuringFeedback"))
          redirectToResults(0, correctAnswers, currentQuestionIndex + 1, true)
        } else if (currentQuestionIndex + 1 >= totalQuestions) {
          console.log(t("log.allQuestionsAnswered"))
          redirectToResults(playerHealth, correctAnswers, totalQuestions, false, correctAnswers === totalQuestions)
        } else {
          await nextQuestion()
        }
      }, FEEDBACK_DURATION)
      return () => clearTimeout(feedbackTimer)
    }
  }, [showFeedback, playerHealth, correctAnswers, currentQuestionIndex, isCorrect, totalQuestions])

  const nextQuestion = async () => {
    if (!room || !currentPlayer) {
      console.error("Room or currentPlayer is null, cannot advance to next question.");
      return false;
    }
    // Update current_index di player state
    const { data: roomData, error } = await supabase
      .from("game_rooms")
      .select("players")
      .eq("id", room.id)
      .single()

    if (error) {
      console.error("Error updating next question index:", error)
      return false
    }

    const currentPlayers = roomData?.players || []
    const playerIndex = currentPlayers.findIndex((p: any) => p.player_id === currentPlayer.player_id)
    if (playerIndex !== -1) {
      currentPlayers[playerIndex].current_index = currentQuestionIndex + 1
      await supabase
        .from("game_rooms")
        .update({ players: currentPlayers })
        .eq("id", room.id)
    }

    // onNextQuestion is not a prop anymore
    // if (onNextQuestion) {
    //   const success = await onNextQuestion(currentQuestionIndex);
    //   if (!success) {
    //     console.error("Failed to advance to next question");
    //     return false;
    //   }
    // }

    setCurrentQuestionIndex(prevIndex => prevIndex + 1)
    setSelectedAnswer(null)
    setIsAnswered(false)
    setIsCorrect(null)
    return true;
  }

  const handleAnswerSelect = async (answer: string) => {
    if (isAnswered || !currentQuestion || isProcessingAnswer) return
    if (!room || !currentPlayer) {
      console.error("Room or currentPlayer is null, cannot handle answer selection.");
      return;
    }

    // Cek apakah sudah dijawab sebelumnya
    const { data: roomData, error } = await supabase
      .from("game_rooms")
      .select("players")
      .eq("id", room.id)
      .single()

    if (error) {
      console.error("Error checking existing answer:", error)
      return
    }

    const playerData = roomData?.players?.find((p: any) => p.player_id === currentPlayer.player_id)
    const existingAnswer = playerData?.answers?.find((a: any) => a.question_index === currentQuestionIndex)
    if (existingAnswer) {
      console.log(t("log.alreadyAnswered"))
      return
    }

    setSelectedAnswer(answer)
    setIsAnswered(true)
    setInactivityCountdown(null)
    setPenaltyCountdown(null)

    const playerSelectedLetter = answer.trim().toUpperCase().charAt(0);
    const normalizedPlayerAnswer = playerSelectedLetter.toLowerCase();
    const normalizedCorrectAnswer = currentQuestion?.correct_answer ? currentQuestion.correct_answer.trim().toLowerCase() : '';
    const isCorrectAnswer = normalizedPlayerAnswer === normalizedCorrectAnswer;

    console.log("handleAnswerSelect Debug:");
    console.log("  Selected Answer (raw):", answer);
    console.log("  Correct Answer (raw):", currentQuestion?.correct_answer);
    console.log("  Normalized Player Answer:", normalizedPlayerAnswer);
    console.log("  Normalized Correct Answer:", normalizedCorrectAnswer);
    console.log("  Is Correct Answer:", isCorrectAnswer);

    // onSubmitAnswer is not a prop anymore
    // let submitSuccess = true;
    // if (onSubmitAnswer) {
    //   submitSuccess = await onSubmitAnswer(answer, isCorrectAnswer, currentQuestionIndex);
    // }

    // if (!submitSuccess) {
    //   console.error("Failed to submit answer via hook");
    //   return;
    // }

    // Lanjutkan logic lokal (save ke DB, update state, dll.)
    if (isCorrectAnswer) {
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

    await saveAnswerAndUpdatePlayerState(selectedAnswer || "", true)
  }

  const handleWrongAnswer = async () => {
    if (isProcessingAnswer) return

    setIsCorrect(false)
    setShowFeedback(true)

    await saveAnswerAndUpdatePlayerState(selectedAnswer || "TIME_UP", false)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`
  }

  const getAnswerButtonClass = (option: string) => {
    const normalizedOption = option.trim().toLowerCase();
    const normalizedCorrectAnswer = currentQuestion?.correct_answer ? currentQuestion.correct_answer.trim().toLowerCase() : '';
    const normalizedSelectedAnswer = selectedAnswer ? selectedAnswer.trim().toLowerCase() : null;

    console.log("getAnswerButtonClass Debug for option:", option);
    console.log("  normalizedOption:", normalizedOption);
    console.log("  normalizedCorrectAnswer:", normalizedCorrectAnswer);
    console.log("  normalizedSelectedAnswer:", normalizedSelectedAnswer);
    console.log("  isAnswered:", isAnswered);

    if (!isAnswered) {
      console.log("  Returning: bg-gray-800 (not answered)");
      return "bg-gray-800 border-gray-600 text-white"
    }

    // If the option is the correct answer
    if (normalizedOption === normalizedCorrectAnswer) {
      console.log("  Returning: bg-green-600 (correct answer)");
      return "bg-green-600 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"
    }

    // If the option is the selected answer AND it's not the correct answer
    if (normalizedOption === normalizedSelectedAnswer && normalizedOption !== normalizedCorrectAnswer) {
      console.log("  Returning: bg-red-600 (selected incorrect answer)");
      return "bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
    }

    console.log("  Returning: bg-gray-700 (unselected incorrect answer)");
    return "bg-gray-700 border-gray-600 text-gray-400"
  }

  if (!room || !currentPlayer) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Skull className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
          <p className="text-white font-mono text-xl">{t("loadingGame")}</p>
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
                          option !== currentQuestion?.correct_answer && (
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
        <ZombieFeedback isCorrect={isCorrect} isVisible={showFeedback} activeZombie={room.chaser_type} activePlayer={currentPlayer.character_type} />
      </div>
    </div>
  )
}