"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation" // useSearchParams dihapus
import { mysupa, supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Trophy, Skull, Heart, Target, Clock, Home, RotateCcw, AlertTriangle, Zap } from "lucide-react"
import { motion, AnimatePresence, type Transition } from "framer-motion"
import { HorrorCard } from "@/components/ui/horror-card"
import type { GameRoom } from "@/lib/supabase"
import Image from "next/image"
import { useTranslation } from "react-i18next"
import { debounce } from "lodash"
import Link from "next/link"
import { Session } from "../quiz/page"

// Interface tidak berubah
interface GameCompletion {
  id: string
  player_id: string
  final_health: number
  correct_answers: number
  total_questions_answered: number
  is_eliminated: boolean
  completion_type: string
  completed_at: string
  players: {
    nickname: string
    character_type: string
  }
}

interface PlayerStats {
  id: string
  nickname: string
  score: number
  correct_answers: number
  is_alive: boolean
  rank: number
}

interface RoomStats {
  total_players: number
  alive_players: number
  total_attacks: number
  recent_attacks: number
  average_health: number
}

interface GameActivity {
  activity_type: string
  player_nickname: string
  activity_data: {
    correct_answers?: number
    final_health?: number
    is_eliminated?: boolean
    completion_type?: string
    damage?: number
    attack_type?: string
    attack_data?: {
      question_index?: number
      answer?: string
      player_nickname?: string
      damage_dealt?: number
    }
  }
  activity_time: string
}

// Interface baru untuk data pemain yang sudah diproses
interface PlayerData {
  health: number
  correct: number
  total: number
  eliminated: boolean
  perfect: boolean
  nickname: string
}

const characterGifs = [
  { value: "robot1", name: "Hijau", gif: "/character/player/character.webp", alt: "Karakter Hijau" },
  { value: "robot2", name: "Biru", gif: "/character/player/character1-crop.webp", alt: "Karakter Biru" },
  { value: "robot3", name: "Merah", gif: "/character/player/character2-crop.webp", alt: "Karakter Merah" },
  { value: "robot4", name: "Ungu", gif: "/character/player/character3-crop.webp", alt: "Karakter Ungu" },
  { value: "robot5", name: "Oranye", gif: "/character/player/character4-crop.webp", alt: "Karakter Oranye" },
  { value: "robot6", name: "Kuning", gif: "/character/player/character5.webp", alt: "Karakter Kuning" },
  { value: "robot7", name: "Abu-abu", gif: "/character/player/character6.webp", alt: "Karakter Abu-abu" },
  { value: "robot8", name: "Pink", gif: "/character/player/character7-crop.webp", alt: "Karakter Pink" },
  { value: "robot9", name: "Cokelat", gif: "/character/player/character8-crop.webp", alt: "Karakter Cokelat" },
  { value: "robot10", name: "Emas", gif: "/character/player/character9-crop.webp", alt: "Karakter Emas" },

]

export default function ResultsPage() {
  const { t } = useTranslation()
  const router = useRouter();
  const params = useParams()
  const roomCode = params.roomCode as string

  const [session, setSession] = useState<Partial<Session> | null>(null);

  const [gameCompletions, setGameCompletions] = useState<GameCompletion[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [roomStats, setRoomStats] = useState<RoomStats | null>(null)
  const [recentActivities, setRecentActivities] = useState<GameActivity[]>([])
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playerData, setPlayerData] = useState<PlayerData | null>(null) // State untuk data pemain
  const [characterGif, setCharacterGif] = useState<string>()
  const [flickerText, setFlickerText] = useState(true);

  const isMountedRef = useRef(true)
  const channelsRef = useRef<any[]>([])

  if (typeof window !== "undefined") {
    sessionStorage.setItem("redirectTo", window.location.pathname);
  }

  const initializePlayerData = useCallback(async () => {
    const playerId = localStorage.getItem("playerId");
    if (!playerId) {
      setError("Player tidak ditemukan");
      return;
    }

    try {
      // 1. Ambil participant langsung
      const { data: p, error } = await mysupa
        .from("participants")
        .select("nickname, character_type, score, correct_answers, health, answers, finished_at")
        .eq("id", playerId)
        .single();

      if (error || !p) throw error;

      const totalQuestions = session?.question_limit || p.answers?.length || 0;

      const data: PlayerData = {
        health: p.health.current,
        correct: p.correct_answers,
        total: totalQuestions,
        eliminated: p.health.current <= 0,
        perfect: p.correct_answers === totalQuestions && totalQuestions > 0,
        nickname: p.nickname,
      };

      setPlayerData(data);

      const char = characterGifs.find(c => c.value === p.character_type);
      setCharacterGif(char?.gif || characterGifs[0].gif);
      setIsLoading(false);

    } catch (err) {
      console.error(err);
      setError("Gagal load hasil");
      setIsLoading(false);
    }
  }, [session?.started_at]);

  useEffect(() => {
    const load = async () => {
      // Ambil session dulu biar bisa hitung survival
      const { data: sess } = await mysupa
        .from("sessions")
        .select("started_at")
        .eq("game_pin", roomCode.toUpperCase())
        .single();

      setSession(sess);
      await initializePlayerData();
    };

    load();
  }, [roomCode, initializePlayerData]);

  useEffect(() => {
    const flickerInterval = setInterval(
      () => {
        setFlickerText((prev) => !prev);
      },
      100 + Math.random() * 150,
    );

    return () => {
      clearInterval(flickerInterval);
    };
  }, []);

  useEffect(() => {
    return () => {
      console.log("Komponen dilepas (unmounting)")
      isMountedRef.current = false
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel)
      })
      channelsRef.current = []
    }
  }, [])

  const getPerformanceTitle = () => {
    if (!playerData) return t("performanceTitle.noData");

    const accuracy =
      playerData.total > 0 ? (playerData.correct / playerData.total) * 100 : 0;

    if (playerData.perfect) return t("performanceTitle.perfect");
    if (accuracy >= 90) return t("performanceTitle.accuracy90");
    if (accuracy >= 80) return t("performanceTitle.accuracy80");
    if (accuracy >= 70) return t("performanceTitle.accuracy70");
    if (accuracy >= 60) return t("performanceTitle.accuracy60");
    if (accuracy >= 50) return t("performanceTitle.accuracy50");
    if (accuracy >= 40) return t("performanceTitle.accuracy40");
    if (accuracy >= 30) return t("performanceTitle.accuracy30");
    if (accuracy >= 20) return t("performanceTitle.accuracy20");

    return t("performanceTitle.default");
  };

  const getPerformanceMessage = () => {
    if (!playerData) return t("performance.noData");

    const accuracy =
      playerData.total > 0 ? (playerData.correct / playerData.total) * 100 : 0;

    if (playerData.perfect) return t("performance.perfect");
    if (playerData.eliminated) return t("performance.eliminated");
    if (accuracy >= 90) return t("performance.accuracy90");
    if (accuracy >= 70) return t("performance.accuracy70");
    if (accuracy >= 50) return t("performance.accuracy50");

    return t("performance.default");
  }

  const getActivityMessage = (activity: GameActivity) => {
    const totalQuestions = playerData?.total || 10

    if (activity.activity_type === "completion") {
      const { correct_answers, final_health, is_eliminated, completion_type } = activity.activity_data
      if (is_eliminated) {
        return `${activity.player_nickname} bertarung gagah berani! (${correct_answers}/${totalQuestions} benar)`
      }
      if (completion_type === "completed") {
        return `${activity.player_nickname} menaklukkan petualangan! (${correct_answers}/${totalQuestions} benar, ${final_health} HP)`
      }
      return `${activity.player_nickname} menyelesaikan tantangan! (${correct_answers}/${totalQuestions} benar, ${final_health} HP)`
    }
    if (activity.activity_type === "attack") {
      const { attack_type, attack_data, damage } = activity.activity_data
      if (attack_type === "wrong_answer") {
        const questionIndex = attack_data?.question_index ?? -1
        const questionMessage = questionIndex !== -1 ? ` pada pertanyaan ${questionIndex + 1}` : ""
        return `${activity.player_nickname} menghadapi rintangan${questionMessage}! (-${damage} HP) Tetap semangat!`
      }
      return `${activity.player_nickname} menghadapi tantangan ${attack_type}! (-${damage} HP) Ayo bangkit!`
    }
    return `${activity.player_nickname} menghadapi ujian baru! Tetap kuat!`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/10 via-black to-purple-900/10" />
        <div className="text-center z-10">

          <p className="text-white font-mono text-xl mb-4 tracking-widest">{t("result.loadingTitle")}</p>
          <p className="text-gray-400 font-mono text-sm">{t("result.loadingSubtitle")}</p>
        </div>
      </div>
    )
  }

  // Tampilan jika data pemain tidak bisa dimuat tapi data lain mungkin ada
  if (!playerData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/10 via-black to-purple-900/10" />
        <div className="text-center z-10 p-4">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <p className="text-white font-mono text-xl mb-4 tracking-widest">{t("result.errorTitle")}</p>
          <p className="text-yellow-400 font-mono text-sm mb-6 max-w-md mx-auto">
            {error || t("result.errorMessage")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button

              onClick={() => (window.location.href = "/")}
              className="bg-gray-900 hover:bg-gray-800 text-white font-mono border border-gray-700"
            >
              <Home className="w-4 h-4 mr-2" />
              {t("common.home")}
            </Button>
            <Button
              onClick={initializePlayerData}
              className="bg-red-900 hover:bg-red-800 text-white font-mono border border-red-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {t("common.retry")}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Render utama jika playerData berhasil dimuat
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <Image
        src="/background/10.gif"
        alt="Background"
        layout="fill"
        objectFit="cover"
        quality={100}
        className="absolute inset-0 z-0 opacity-20"
      />

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-red-900 rounded-full opacity-10 blur-xl" />
        <div className="absolute top-1/3 right-20 w-24 h-24 bg-red-900 rounded-full opacity-10 blur-xl" />
        <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-red-900 rounded-full opacity-10 blur-xl" />
        <div className="absolute bottom-1/3 right-1/4 w-20 h-20 bg-red-900 rounded-full opacity-10 blur-xl" />
      </div>

      <div className="absolute inset-0">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-red-900/50 rounded-full"
            initial={{
              x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== "undefined" ? window.innerHeight : 1000),
              opacity: 0,
            }}
            animate={{
              y: -100,
              opacity: [0, 0.5, 0],
            }}
            transition={
              {
                duration: 5 + Math.random() * 5,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "loop",
                delay: Math.random() * 5,
              } as Transition
            }
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto p-5 md:p-7">
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-1 mb-7 md:mb-10"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="hidden sm:block">
              <Link href={"/"}>
                <Image
                  src="/logo/quizrushlogo.png"
                  alt="QuizRush Logo"
                  width={140}   // turunin sedikit biar proporsional
                  height={35}   // sesuaikan tinggi
                  className="w-32 md:w-40 lg:w-48 h-auto"   // ini yang paling berpengaruh
                  unoptimized
                />
              </Link>
            </div>

            <div className="flex w-fit gap-2 items-center">
              <img
                src={`/logo/gameforsmartlogo-horror.png`}
                alt="Game for Smart Logo"
                className="w-36 md:w-52 lg:w-64 h-auto mr-3 hidden sm:block"
              />
              {/* Tombol Home (hanya terlihat di desktop) */}
              <motion.button
                onClick={() => router.push("/")}
                whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
                whileTap={{ scale: 0.95 }}
                className="bg-red-800 text-white p-2 border-2 border-red-600 rounded-md hidden sm:block"
                aria-label={t("homeButton")}
              >
                <Home className="w-3 h-3" />
              </motion.button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
            className="flex justify-center items-center text-center"
          >

            <h1
              className={`mx-3 text-5xl font-bold font-mono tracking-wider transition-all duration-150 animate-pulse text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("result.title")}
            </h1>

          </motion.div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <HorrorCard variant="blood" glowing animated className="max-w-4xl mx-auto mb-8 p-0">
            <div className="p-7 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/4 w-1 h-16 bg-red-900/70" />
              <div className="absolute top-0 right-1/3 w-1 h-10 bg-red-900/70" />

              <div className="relative z-10">
                <h2 className="text-3xl font-bold text-white mb-2 font-horror tracking-wider text-red-500">
                  {getPerformanceTitle()}
                </h2>

                <div className="mb-6 flex justify-center">
                  <Image
                    src={characterGif || "/placeholder.svg"}
                    width={80}
                    height={80}
                    alt="Karakter"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-900/70 rounded-lg p-4 border border-red-900/50">
                    <Target className="w-6 h-6 text-green-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white font-mono">{playerData.correct}</div>
                    <div className="text-xs text-gray-400 tracking-widest">{t("correct")}</div>
                  </div>

                  <div className="bg-gray-900/70 rounded-lg p-4 border border-red-900/50">
                    <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white font-mono">{playerData.health}</div>
                    <div className="text-xs text-gray-400 tracking-widest">{t("health")}</div>
                  </div>

                  <div className="bg-gray-900/70 rounded-lg p-4 border border-red-900/50">
                    <Zap className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white font-mono">
                      {playerData.total > 0 ? Math.round((playerData.correct / playerData.total) * 100) : 0}%
                    </div>
                    <div className="text-xs text-gray-400 tracking-widest">{t("accuracy")}</div>
                  </div>
                </div>
              </div>
            </div>
          </HorrorCard>
        </motion.div>

        {/* Tombol Home (hanya terlihat di mobile, di bagian bawah) */}
        <div className="text-center">
          <motion.button
            onClick={() => router.push("/")}
            whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            whileTap={{ scale: 0.95 }}
            className="bg-red-800 text-white px-5 py-1 border-2 border-red-600 rounded-lg z-50 font-mono inline-block"
            aria-label={t("homeButton")}
          >
            {t("homeButton")}
          </motion.button>
        </div>

      </div>
    </div>
  )
}
