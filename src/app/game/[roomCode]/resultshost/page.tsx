"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { motion } from "framer-motion"
import Image from "next/image"
import Confetti from "react-confetti"
import { Trophy, Clock, Ghost } from "lucide-react"
import { t } from "i18next"

interface Player {
  id: string
  nickname: string
  character_type: string
  score: number
  is_alive: boolean
  joined_at: string
}

interface GameCompletion {
  id: string
  player_id: string
  room_id: string
  final_health: number
  correct_answers: number
  total_questions_answered: number
  is_eliminated: boolean
  completion_type: string
  completed_at: string
  survival_duration: number
  game_start_time: string
  player_join_time: string
}

interface PlayerHealthState {
  id: string
  player_id: string
  room_id: string
  health: number
  speed: number
  last_answer_time: string
}

interface GameRoom {
  id: string
  room_code: string
  title: string
  status: string
  max_players: number
  current_phase: string
  game_start_time: string | null
  questions: any[]
}

interface PlayerResult {
  id: string
  nickname: string
  character_type: string
  rank: number
  duration: string
  isLolos: boolean
  correctAnswers: number
  totalQuestions: number
  finalScore: number
  finalHealth: number
  completionTime: string
  survivalSeconds: number
}

const characterGifs = [
  { src: "/character/character.gif", alt: "Karakter Hijau", color: "bg-green-500", type: "robot1", name: "Hijau" },
  { src: "/character/character1.gif", alt: "Karakter Biru", color: "bg-blue-500", type: "robot2", name: "Biru" },
  { src: "/character/character2.gif", alt: "Karakter Merah", color: "bg-red-500", type: "robot3", name: "Merah" },
  { src: "/character/character3.gif", alt: "Karakter Ungu", color: "bg-purple-500", type: "robot4", name: "Ungu" },
  { src: "/character/character4.gif", alt: "Karakter Oranye", color: "bg-orange-500", type: "robot5", name: "Oranye" },
  { src: "/character/character5.gif", alt: "Karakter Kuning", color: "bg-yellow-500", type: "robot6", name: "Kuning" },
  { src: "/character/character6.gif", alt: "Karakter Abu-abu", color: "bg-gray-500", type: "robot7", name: "Abu-abu" },
  { src: "/character/character7.gif", alt: "Karakter Pink", color: "bg-pink-500", type: "robot8", name: "Pink" },
  { src: "/character/character8.gif", alt: "Karakter Cokelat", color: "bg-brown-500", type: "robot9", name: "Cokelat" },
  { src: "/character/character9.gif", alt: "Karakter Emas", color: "bg-yellow-600", type: "robot10", name: "Emas" },
]

export default function ResultsHostPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.roomCode as string
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null)
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [showContent, setShowContent] = useState(false)
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([])

  const getCharacterByType = (type: string) => {
    return characterGifs.find((char) => char.type === type) || characterGifs[0]
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const calculateAccurateDuration = (
    gameStartTime: string | null,
    completedAt: string,
    joinedAt: string,
    survivalDuration?: number,
  ) => {
    if (survivalDuration !== undefined && survivalDuration > 0) {
      return survivalDuration
    }

    if (!gameStartTime) return 0

    const startTime = new Date(gameStartTime).getTime()
    const endTime = new Date(completedAt).getTime()
    const joinTime = new Date(joinedAt).getTime()

    const effectiveStart = Math.max(startTime, joinTime)
    const durationMs = Math.max(0, endTime - effectiveStart)
    return Math.floor(durationMs / 1000)
  }

  const calculateFallbackDuration = (start: string | null, end: string, joined: string) => {
    return calculateAccurateDuration(start, end, joined)
  }

  const getColumnsLayout = (players: PlayerResult[]) => {
    const leftColumn = players.slice(0, 4)
    const rightColumn = players.slice(4, 8)
    return [leftColumn, rightColumn].filter((column) => column.length > 0)
  }

  useEffect(() => {
    const fetchGameData = async () => {
      if (!roomCode) {
        setLoadingError("Kode ruangan tidak valid")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const { data: room, error: roomError } = await supabase
          .from("game_rooms")
          .select("*, questions")
          .eq("room_code", roomCode.toUpperCase())
          .single()

        if (roomError || !room) {
          throw new Error("Ruangan tidak ditemukan")
        }

        setGameRoom(room)

        const { data: playersData, error: playersError } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", room.id)

        if (playersError) {
          throw new Error("Gagal mengambil data pemain")
        }

        const { data: completionData, error: completionError } = await supabase
          .from("game_completions")
          .select("*, survival_duration, game_start_time, player_join_time")
          .eq("room_id", room.id)
          .order("completed_at", { ascending: false })

        if (completionError) {
          console.error("Error fetching completions:", completionError)
        }

        const uniqueCompletions =
          completionData?.reduce((acc: GameCompletion[], current: GameCompletion) => {
            if (!acc.some((c) => c.player_id === current.player_id)) {
              acc.push(current)
            }
            return acc
          }, []) || []

        const { data: healthData, error: healthError } = await supabase
          .from("player_health_states")
          .select("*")
          .eq("room_id", room.id)

        if (healthError) {
          console.error("Error fetching health states:", healthError)
        }

        const totalQuestions = room.questions?.length || 0
        const gameEndTime = new Date().toISOString()

        const processedResults: PlayerResult[] = (playersData || []).map((player: Player) => {
          const completion = uniqueCompletions.find((c: any) => c.player_id === player.id)
          const healthState = healthData?.find((h) => h.player_id === player.id)

          let finalHealth = 3
          let survivalSeconds = 0
          let isEliminated = false

          if (completion) {
            finalHealth = completion.final_health
            isEliminated = completion.is_eliminated
            survivalSeconds = calculateAccurateDuration(
              room.game_start_time,
              completion.completed_at,
              player.joined_at,
              completion.survival_duration,
            )
          } else if (healthState) {
            finalHealth = healthState.health
            isEliminated = finalHealth <= 0
            survivalSeconds = calculateFallbackDuration(room.game_start_time, gameEndTime, player.joined_at)
          } else {
            survivalSeconds = 0
            isEliminated = true
            finalHealth = 0
          }

          const actuallyEliminated = isEliminated || finalHealth <= 0
          const isLolos = !actuallyEliminated && finalHealth > 0
          const completionTime = completion ? completion.completed_at : gameEndTime
          const duration = formatDuration(survivalSeconds)
          const correctAnswers = completion ? completion.correct_answers : 0
          const finalScore = correctAnswers * 100 + finalHealth * 50

          console.log(`[v0] Player ${player.nickname} timing - Duration: ${survivalSeconds}s, Formatted: ${duration}`)

          return {
            id: player.id,
            nickname: player.nickname,
            character_type: player.character_type,
            rank: 0,
            duration,
            isLolos,
            correctAnswers,
            totalQuestions,
            finalScore,
            finalHealth,
            completionTime,
            survivalSeconds,
          }
        })

        const rankedResults = processedResults
          .sort((a, b) => {
            if (a.isLolos !== b.isLolos) {
              return a.isLolos ? -1 : 1
            }

            if (a.finalScore !== b.finalScore) {
              return b.finalScore - a.finalScore
            }

            if (a.isLolos) {
              return a.survivalSeconds - b.survivalSeconds
            } else {
              return b.survivalSeconds - a.survivalSeconds
            }
          })
          .map((result, index) => ({
            ...result,
            rank: index + 1,
          }))

        setPlayerResults(rankedResults)

        if (rankedResults.some((r) => r.isLolos)) {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 8000)
        }

        setTimeout(() => {
          setShowContent(true)
        }, 1500)
      } catch (error) {
        console.error("Gagal mengambil data:", error)
        setLoadingError("Gagal memuat hasil permainan. Silakan coba lagi.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchGameData()
  }, [roomCode])

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const generateBlood = () => {
      const newBlood = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        speed: 0.5 + Math.random() * 2,
        delay: Math.random() * 5,
      }))
      setBloodDrips(newBlood)
    }

    generateBlood()
    const bloodInterval = setInterval(() => {
      generateBlood()
    }, 8000)

    return () => clearInterval(bloodInterval)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="text-red-500 text-3xl font-bold font-mono flex items-center justify-center h-full space-x-4"
        >
          <span>Loading...</span>
        </motion.div>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="text-center flex items-center justify-center h-full"
        >
          <p className="text-red-500 text-2xl font-mono mb-6">{loadingError}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="bg-red-900 text-white font-mono py-3 px-6 border-2 border-red-700"
            style={{ boxShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
          >
            Coba Lagi
          </motion.button>
        </motion.div>
      </div>
    )
  }

  const columnsData = getColumnsLayout(playerResults)

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none font-mono">
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          colors={["#8B0000", "#FF0000", "#4B0082", "#2E8B57"]}
          gravity={0.3}
          wind={0.02}
        />
      )}

      {/* Blood-stained background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-black to-purple-900/10">
        <div className="absolute inset-0 opacity-20">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute w-64 h-64 bg-red-900 rounded-full mix-blend-multiply blur-xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: 0.3 + Math.random() * 0.4,
              }}
            />
          ))}
        </div>
      </div>

      {/* Blood drips */}
      {bloodDrips.map((drip) => (
        <div
          key={drip.id}
          className="absolute top-0 w-0.5 h-20 bg-red-600/80 animate-fall"
          style={{
            left: `${drip.left}%`,
            animation: `fall ${drip.speed}s linear ${drip.delay}s infinite`,
            opacity: 0.7 + Math.random() * 0.3,
          }}
        />
      ))}

      {/* Floating skulls */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute text-red-900/20 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              fontSize: `${2 + Math.random() * 3}rem`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${15 + Math.random() * 20}s`,
            }}
          >
            <Ghost />
          </div>
        ))}
      </div>

      {/* Scratch overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJzY3JhdGNoZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48cGF0aCBkPSJNMCAwTDUwMCA1MDAiIHN0cm9rZT0icmdiYSgyNTUsMCwwLDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48cGF0aCBkPSJNMCAxMDBMNTAwIDYwMCIgc3Ryb2tlPSJyZ2JhKDI1NSwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDIwMEw1MDAgNzAwIiBzdHJva2U9InJnYmEoMjU1LDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NjcmF0Y2hlcykiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] opacity-20" />

      {/* Blood stains in corners */}
      <div className="absolute top-0 left-0 w-64 h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>
      <div className="absolute top-0 right-0 w-64 h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 w-64 h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 right-0 w-64 h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0.8 }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
        className="relative z-10 container mx-auto px-4 py-8"
      >
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.5, type: "spring", stiffness: 100 }}
          className="text-center mb-8"
        >
          <h1
            className="text-6xl md:text-8xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
            style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
          >
            {t("title")}
          </h1>
        </motion.header>

                <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 2.0, type: "spring" }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-7xl mx-auto mt-8 mb-8"
        >
          {[
            {
              value: playerResults.filter((p) => p.isLolos).length,
              label: "Selamat",
              color: "#2ED84A",
              icon: <Trophy className="w-6 h-6 mx-auto mb-2" />,
            },
            {
              value: playerResults.filter((p) => !p.isLolos).length,
              label: "Gagal",
              color: "#FF0000",
              icon: <Trophy className="w-6 h-6 mx-auto mb-2" />,
            },
            {
              value: gameRoom?.questions?.length || 0,
              label: "Total Soal",
              color: "#FFFFFF",
              icon: <Trophy className="w-6 h-6 mx-auto mb-2" />,
            },
            {
              value: playerResults.length,
              label: "Total Pemain",
              color: "#FFFFFF",
              icon: <Trophy className="w-6 h-6 mx-auto mb-2" />,
            },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5, delay: 2.2 + index * 0.2, type: "spring" }}
              className="bg-red-900/50 p-4 text-center border border-red-700/50 rounded-lg"
              style={{ boxShadow: "0 0 10px rgba(239, 68, 68, 0.5)" }}
            >
              <div className="text-lg font-bold text-white">
                {stat.icon}
                {stat.value}
              </div>
              <div className="text-xs text-red-400 mt-2 uppercase">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 0.8 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto"
        >
          {columnsData.map((column, columnIndex) => (
            <div key={columnIndex} className="space-y-6">
              {column.map((player, playerIndex) => {
                const character = getCharacterByType(player.character_type)
                const animationDelay = 1.5 + (player.rank - 1) * 0.2

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: player.rank % 2 === 0 ? 100 : -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.8,
                      delay: animationDelay,
                      type: "spring",
                      stiffness: 120,
                    }}
                    whileHover={{
                      scale: 1.03,
                      transition: { duration: 0.3 },
                    }}
                    className="relative bg-gradient-to-br from-black via-red-950/80 to-black border-2 border-red-600/70 rounded-2xl p-6 hover:border-red-400 hover:shadow-[0_0_30px_rgba(220,38,38,0.8),inset_0_0_20px_rgba(220,38,38,0.1)] transition-all duration-500 backdrop-blur-sm overflow-hidden"
                    style={{
                      minHeight: "200px",
                      background: `
                        radial-gradient(circle at 20% 80%, rgba(139, 0, 0, 0.3) 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, rgba(75, 0, 130, 0.2) 0%, transparent 50%),
                        linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(20, 5, 5, 0.95) 30%, rgba(40, 0, 0, 0.95) 70%, rgba(0, 0, 0, 0.95) 100%)
                      `,
                      boxShadow: `
                        0 0 20px rgba(220, 38, 38, 0.4),
                        inset 0 0 30px rgba(0, 0, 0, 0.8),
                        inset 0 1px 0 rgba(220, 38, 38, 0.2)
                      `,
                    }}
                  >
                    {/* Blood splatter decorations */}
                    <div className="absolute top-2 right-4 w-3 h-3 bg-red-600 rounded-full opacity-60" />
                    <div className="absolute top-6 right-2 w-2 h-2 bg-red-700 rounded-full opacity-40" />
                    <div className="absolute bottom-4 left-2 w-4 h-4 bg-red-800 rounded-full opacity-30" />

                    {/* Scratch marks overlay */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-4 left-8 w-16 h-0.5 bg-red-400 rotate-12" />
                      <div className="absolute top-6 left-10 w-12 h-0.5 bg-red-400 rotate-12" />
                      <div className="absolute bottom-8 right-6 w-20 h-0.5 bg-red-400 -rotate-45" />
                    </div>

                    {/* Rank number - horror style with blood drip effect */}
                    <div className="absolute -top-4 -left-4 w-16 h-16 bg-gradient-to-br from-red-700 to-red-900 rounded-full flex items-center justify-center text-white font-bold text-2xl border-4 border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.8)]">
                      <div className="relative">
                        {player.rank}
                        {/* Blood drip effect */}
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-3 bg-red-600 rounded-b-full opacity-70" />
                      </div>
                      {player.rank === 1 && (
                        <motion.div
                          animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
                          transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY }}
                          className="absolute -top-3 -right-3"
                        >
                          <Trophy className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]" />
                        </motion.div>
                      )}
                    </div>

                    {/* Main content layout */}
                    <div className="flex items-center gap-8 h-full pt-4">
                      {/* Character GIF - larger with horror frame */}
                      <div className="flex-shrink-0">
                        <div className="relative">
                          <div className="w-28 h-28 rounded-xl overflow-hidden border-4 border-red-500/80 shadow-[0_0_20px_rgba(220,38,38,0.6)] bg-gradient-to-br from-red-950/50 to-black/50">
                            <Image
                              src={character.src || "/placeholder.svg"}
                              alt={character.alt}
                              width={112}
                              height={112}
                              className="w-full h-full object-cover"
                              style={{
                                filter: !player.isLolos
                                  ? "grayscale(100%) brightness(0.4) contrast(1.2) sepia(20%) hue-rotate(320deg)"
                                  : "brightness(1.2) contrast(1.3) saturate(1.1) drop-shadow(0 0 8px rgba(220,38,38,0.4))",
                              }}
                            />
                          </div>
                          {/* Character name badge with horror styling */}
                          <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-800 to-purple-900 text-white text-sm px-3 py-1 rounded-full border-2 border-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.6)]">
                            {character.name}
                          </div>
                          {/* Glow effect for character */}
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-500/20 via-transparent to-red-500/20 pointer-events-none" />
                        </div>
                      </div>

                      {/* Player info section with horror styling */}
                      <div className="flex-grow space-y-4">
                        {/* Player name with blood-stained effect */}
                        <div className="relative bg-gradient-to-r from-red-800/90 to-red-900/90 text-white px-6 py-3 rounded-lg border-2 border-red-600/70 shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                          <h3 className="font-bold text-xl truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {player.nickname}
                          </h3>
                          {/* Blood stain decoration */}
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full opacity-70" />
                        </div>

                        {/* Time and status row with enhanced horror theme */}
                        <div className="flex gap-4">
                          {/* Time with dark theme */}
                          <div className="flex-1 bg-gradient-to-r from-gray-900 to-black text-red-300 px-4 py-3 rounded-lg border-2 border-red-700/50 flex items-center gap-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
                            <Clock className="w-5 h-5 text-red-400" />
                            <span className="font-mono text-lg font-bold">{player.duration}</span>
                          </div>

                          {/* Status with intense colors */}
                          <div
                            className={`flex-1 px-4 py-3 rounded-lg border-2 text-center font-bold text-lg shadow-[0_0_15px_rgba(0,0,0,0.8)] ${
                              player.isLolos
                                ? "bg-gradient-to-r from-green-700 to-green-800 text-white border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                                : "bg-gradient-to-r from-red-700 to-red-800 text-white border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.8)]"
                            }`}
                          >
                            {player.isLolos ? "LOLOS" : "TIDAK LOLOS"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Floating ghost decoration */}
                    <motion.div
                      animate={{
                        y: [-2, 2, -2],
                        opacity: [0.3, 0.6, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                      className="absolute top-4 right-4 text-red-400/40"
                    >
                      <Ghost className="w-6 h-6" />
                    </motion.div>

                    {/* Enhanced glow effect for winners */}
                    {player.isLolos && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/10 via-transparent to-green-500/10 pointer-events-none animate-pulse" />
                    )}

                    {/* Failure overlay for eliminated players */}
                    {!player.isLolos && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-900/20 via-transparent to-red-900/20 pointer-events-none" />
                    )}
                  </motion.div>
                )
              })}
            </div>
          ))}
        </motion.section>



        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 2.5, type: "spring" }}
          className="text-center mt-8"
        >
          <motion.button
            onClick={() => router.push("/")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-red-900 text-white font-mono py-4 px-10 text-lg uppercase border-2 border-red-700 shadow-[0_0_10px_rgba(239,68,68,0.7)] hover:bg-red-800"
          >
            Beranda
          </motion.button>
        </motion.div>
      </motion.div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fall {
          to { transform: translateY(100vh); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </div>
  )
}
