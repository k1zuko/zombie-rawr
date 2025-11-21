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
import toast from "react-hot-toast"

// Define types for GameRoom and EmbeddedPlayer
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
  quiz?: { questions: any[] }
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
  const [roomInfo, setRoomInfo] = useState<Partial<GameRoom> | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [timeLoaded, setTimeLoaded] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [playerHealth, setPlayerHealth] = useState(3)
  const [playerSpeed, setPlayerSpeed] = useState(20)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false)

  const questions = roomInfo?.embedded_questions && roomInfo.embedded_questions.length > 0
    ? roomInfo.embedded_questions
    : room?.quiz?.questions || []
  const totalQuestions = questions.length
  const currentQuestion = questions[currentQuestionIndex]
  const pulseIntensity = timeLeft <= 30 ? (31 - timeLeft) / 30 : 0
  const FEEDBACK_DURATION = 1000

  // Initial data fetching for room and current player
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!roomCode) {
        router.replace("/");
        return;
      }

      const { data: roomData, error: roomError } = await supabase
        .from("game_rooms")
        .select(`*, quiz:quiz_id (questions)`)
        .eq("room_code", roomCode)
        .single();

      if (roomError || !roomData) {
        console.error("Error fetching room:", roomError);
        toast.error("Room tidak ditemukan!");
        router.replace("/");
        return;
      }
      setRoom(roomData);
      setRoomInfo(roomData);

      const playerId = localStorage.getItem("playerId");
      if (playerId) {
        const player = roomData.players?.find((p: EmbeddedPlayer) => p.player_id === playerId) || null;
        setCurrentPlayer(player);
        if (player) {
          setPlayerHealth(player.health.current);
          setPlayerSpeed(player.health.speed);
          setCorrectAnswers(player.correct_answers);
          // Set initial question index based on player's progress
          const lastAnsweredIndex = player.answers.length > 0 ? player.answers[player.answers.length - 1].question_index : -1;
          setCurrentQuestionIndex(lastAnsweredIndex + 1);
        }
      } else {
        console.error("Player ID not found in localStorage.");
        toast.error("Tidak dapat mengidentifikasi pemain. Silakan bergabung kembali.");
        router.replace("/");
      }
    };

    fetchInitialData();
    setIsClient(true);
  }, [roomCode, router]);

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          console.log('Room updated via Realtime!', payload.new);
          const updatedRoomData = payload.new as Partial<GameRoom>;

          // Merge new data without overwriting the nested 'quiz' object
          setRoom(prevRoom => prevRoom ? { ...prevRoom, ...updatedRoomData } : updatedRoomData as GameRoom);
          setRoomInfo(prevRoomInfo => prevRoomInfo ? { ...prevRoomInfo, ...updatedRoomData } : updatedRoomData);

          // Find and update current player's state from the new payload
          const playerId = localStorage.getItem('playerId');
          if (playerId && updatedRoomData.players) {
            const updatedPlayer = updatedRoomData.players.find(p => p.player_id === playerId);
            if (updatedPlayer) {
              setCurrentPlayer(updatedPlayer);
              
              if (updatedPlayer.health?.current !== undefined) {
                setPlayerHealth(updatedPlayer.health.current);
              }
              if (updatedPlayer.health?.speed !== undefined) {
                setPlayerSpeed(updatedPlayer.health.speed);
              }
              if (updatedPlayer.correct_answers !== undefined) {
                setCorrectAnswers(updatedPlayer.correct_answers);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]); // Add state dependencies to ensure re-subscription if local state desyncs, though unlikely

  // Game Timer
  useEffect(() => {
    if (!roomInfo?.game_start_time || !roomInfo.duration) return;

    const start = new Date(roomInfo.game_start_time).getTime()
    const updateTimeLeft = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - start) / 1000)
      const remaining = Math.max(0, (roomInfo.duration ?? 0) - elapsed)
      setTimeLeft(remaining)
      if (!timeLoaded) setTimeLoaded(true)
    }

    updateTimeLeft()
    const interval = setInterval(updateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [roomInfo, timeLoaded]);

  // Redirect on game end (time up or health depleted)
  useEffect(() => {
    if (playerHealth <= 0) {
      console.log(t("log.playerEliminated"));
      redirectToResults(0, correctAnswers, currentQuestionIndex, true);
    }
  }, [playerHealth, correctAnswers, currentQuestionIndex]);

  useEffect(() => {
    if (timeLoaded && timeLeft <= 0 && !isProcessingAnswer) {
      redirectToResults(playerHealth, correctAnswers, currentQuestionIndex, true);
    }
  }, [timeLeft, timeLoaded, isProcessingAnswer, playerHealth, correctAnswers, currentQuestionIndex]);

  // Feedback and question progression
  useEffect(() => {
    if (showFeedback) {
      const feedbackTimer = setTimeout(async () => {
        setShowFeedback(false)
        if (playerHealth <= 0) {
          // Redirect is handled by the other useEffect
        } else if (currentQuestionIndex + 1 >= totalQuestions) {
          redirectToResults(playerHealth, correctAnswers, totalQuestions, false, correctAnswers === totalQuestions)
        } else {
          await nextQuestion()
        }
      }, FEEDBACK_DURATION)
      return () => clearTimeout(feedbackTimer)
    }
  }, [showFeedback, playerHealth, correctAnswers, currentQuestionIndex, totalQuestions]);

  const getDangerLevel = () => {
    if (playerHealth <= 1) return 3
    if (playerHealth <= 2) return 2
    return 1
  }
  const dangerLevel = getDangerLevel()

  const calculateSurvivalDuration = () => {
    if (!roomInfo?.game_start_time || !currentPlayer?.joined_at) return 0;
    const gameStartTime = new Date(roomInfo.game_start_time).getTime();
    const playerJoinTime = new Date(currentPlayer.joined_at).getTime();
    const effectiveStartTime = Math.max(gameStartTime, playerJoinTime);
    return Math.floor((Date.now() - effectiveStartTime) / 1000);
  }

  const saveGameCompletion = async (
    finalHealth: number,
    finalCorrect: number,
    totalAnswered: number,
    isEliminated = false,
  ) => {
    if (!room || !currentPlayer) return;
    try {
      const actuallyEliminated = isEliminated || finalHealth <= 0
      const survivalDuration = calculateSurvivalDuration()
      
      await supabase.from("game_completions").upsert({
        player_id: currentPlayer.player_id,
        room_id: room.id,
        final_health: Math.max(0, finalHealth),
        correct_answers: finalCorrect,
        total_questions_answered: totalAnswered,
        is_eliminated: actuallyEliminated,
        completion_type: actuallyEliminated ? "eliminated" : "completed",
        completed_at: new Date().toISOString(),
        survival_duration: survivalDuration
      });
    } catch (error) {
      console.error(t("log.saveGameCompletionError", { error }))
    }
  }

  const submitAnswer = async (answer: string, isCorrectAnswer: boolean) => {
    if (!room || !currentPlayer) return;
    setIsProcessingAnswer(true);

    const { data: roomData, error: roomError } = await supabase
      .from("game_rooms")
      .select("players")
      .eq("id", room.id)
      .single();

    if (roomError) {
      console.error("Error fetching room for answer save:", roomError);
      setIsProcessingAnswer(false);
      return;
    }

    const currentPlayers = roomData?.players || [];
    const playerIndex = currentPlayers.findIndex((p: any) => p.player_id === currentPlayer.player_id);

    if (playerIndex === -1) {
      console.error("Player not found in room");
      setIsProcessingAnswer(false);
      return;
    }

    const newAnswer = {
      question_index: currentQuestionIndex,
      answer: answer,
      is_correct: isCorrectAnswer,
      answered_at: new Date().toISOString(),
    };

    const newHealth = isCorrectAnswer ? playerHealth : Math.max(0, playerHealth - 1);
    const newSpeed = isCorrectAnswer ? Math.min(playerSpeed + 5, 100) : Math.max(20, playerSpeed - 5);

    const updatedPlayer = {
      ...currentPlayers[playerIndex],
      health: {
        ...currentPlayers[playerIndex].health,
        current: newHealth,
        speed: newSpeed,
        last_answer_time: new Date().toISOString(),
      },
      answers: [...(currentPlayers[playerIndex].answers || []), newAnswer],
      correct_answers: isCorrectAnswer
        ? (currentPlayers[playerIndex].correct_answers || 0) + 1
        : (currentPlayers[playerIndex].correct_answers || 0),
    };

    const updatedPlayers = [...currentPlayers];
    updatedPlayers[playerIndex] = updatedPlayer;

    const { error: updateError } = await supabase
      .from("game_rooms")
      .update({ players: updatedPlayers })
      .eq("id", room.id);

    if (updateError) {
      console.error(t("log.saveAnswerError", { error: updateError.message }));
    } else {
      // Optimistically update local state
      setPlayerHealth(newHealth);
      setPlayerSpeed(newSpeed);
      if (isCorrectAnswer) {
        setCorrectAnswers((prev) => prev + 1);
      }
    }
    setIsProcessingAnswer(false);
  };

  const redirectToResults = async (
    health: number,
    correct: number,
    total: number,
    isEliminated = false,
    isPerfect = false,
  ) => {
    if (!currentPlayer) return;
    
    await saveGameCompletion(health, correct, total, isEliminated);

    const lastResult = {
      playerId: currentPlayer.player_id,
      roomCode: roomCode,
      nickname: currentPlayer.nickname,
      health: Math.max(0, health),
      correct: correct,
      total: total,
      eliminated: isEliminated || health <= 0,
      timestamp: Date.now(),
    };

    localStorage.setItem("lastGameResult", JSON.stringify(lastResult));
    router.push(`/player/${roomCode}/result`);
  }

  const nextQuestion = async () => {
    setCurrentQuestionIndex(prevIndex => prevIndex + 1)
    setSelectedAnswer(null)
    setIsAnswered(false)
    setIsCorrect(null)
  }

  const handleAnswerSelect = async (answer: string, index: number) => {
    if (isAnswered || !currentQuestion || isProcessingAnswer) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);

    const selectedLetter = String.fromCharCode(97 + index); // a, b, c, d
    const correctAnswerLetter = currentQuestion.correct_answer.trim().toLowerCase();

    const isCorrectAnswer = selectedLetter === correctAnswerLetter;
    
    setIsCorrect(isCorrectAnswer);
    setShowFeedback(true);
    
    await submitAnswer(answer, isCorrectAnswer);
  }

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

    if (isCorrectOption) {
      return "bg-green-600 border-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"
    }
    if (isSelectedOption) { // And it's not the correct one
      return "bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
    }
    return "bg-gray-700 border-gray-600 text-gray-400"
  }

  if (!room || !currentPlayer || !currentQuestion) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
     
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
                            {[...Array(currentPlayer.health.max)].map((_, i) => (                 <Heart
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
            <div className="p-4 sm:p-6 md:p-8 relative overflow-hidden">
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
                <div className="mb-6 sm:mb-8 min-h-[6rem] flex items-center justify-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-white leading-relaxed text-center">{currentQuestion.question_text}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentQuestion.options.map((option: string, index: number) => (
                    <Button
                      key={index}
                      onClick={() => handleAnswerSelect(option, index)}
                      disabled={isAnswered || isProcessingAnswer}
                      className={`${getAnswerButtonClass(
                        option,
                        index
                      )} p-4 sm:p-6 h-full text-left justify-start font-mono text-base sm:text-lg border-2 transition-all duration-300 relative overflow-hidden group ${
                        isProcessingAnswer ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="flex items-center space-x-3 relative z-10 w-full">
                        <span className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="flex-1 whitespace-normal text-center md:text-left">{option}</span>
                        {isAnswered && String.fromCharCode(97 + index) === currentQuestion.correct_answer.trim().toLowerCase() && (
                          <CheckCircle className="w-5 h-5 ml-auto animate-pulse flex-shrink-0" />
                        )}
                        {isAnswered &&
                          option === selectedAnswer &&
                          String.fromCharCode(97 + index) !== currentQuestion.correct_answer.trim().toLowerCase() && (
                            <XCircle className="w-5 h-5 ml-auto animate-pulse flex-shrink-0" />
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