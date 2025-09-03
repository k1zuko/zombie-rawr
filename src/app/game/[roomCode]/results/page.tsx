"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation" // useSearchParams dihapus
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Trophy, Skull, Heart, Target, Clock, Home, RotateCcw, AlertTriangle, Zap } from "lucide-react"
import { motion, AnimatePresence, type Transition } from "framer-motion"
import { HorrorCard } from "@/components/ui/horror-card"
import type { GameRoom } from "@/lib/supabase"
import Image from "next/image"
import { useTranslation } from "react-i18next"
import { debounce } from "lodash"
import Link from "next/link"

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
  "character/player/character.gif",
  "character/player/character1.gif",
  "character/player/character2.gif",
  "character/player/character3.gif",
  "character/player/character4.gif",
  "character/player/character5.gif",
  "character/player/character6.gif",
  "character/player/character7.gif",
  "character/player/character8.gif",
  "character/player/character9.gif",
]

export default function ResultsPage() {
  const { t } = useTranslation()
  const router = useRouter();
  const params = useParams()
  const roomCode = params.roomCode as string

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

  const initializePlayerData = useCallback(
    async (roomId: string) => {
      console.log("Menginisialisasi data pemain...")
      let localData = null

      try {
        // Try specific key first
        const specificKey = `gameResult_${roomCode}_`
        const allKeys = Object.keys(localStorage).filter((key) => key.startsWith(specificKey))

        if (allKeys.length > 0) {
          // Get the most recent one
          const recentKey = allKeys.sort((a, b) => {
            const dataA = JSON.parse(localStorage.getItem(a) || "{}")
            const dataB = JSON.parse(localStorage.getItem(b) || "{}")
            return (dataB.timestamp || 0) - (dataA.timestamp || 0)
          })[0]

          localData = JSON.parse(localStorage.getItem(recentKey) || "{}")
          console.log("Found specific game result:", localData)
        } else {
          // Fallback to general key
          const storedResult = localStorage.getItem("lastGameResult")
          if (storedResult) {
            localData = JSON.parse(storedResult)
            if (localData.roomCode !== roomCode) {
              console.warn("Data LocalStorage berasal dari ruangan yang berbeda. Mengabaikan.")
              localData = null
            }
          }
        }
      } catch (err) {
        console.error("Gagal mem-parsing data dari localStorage:", err)
      }

      if (!localData?.playerId) {
        setError("Tidak dapat mengidentifikasi pemain. Hanya menampilkan data ruangan.")
        console.error("Tidak ada playerId yang ditemukan di localStorage. Pengguna mungkin langsung membuka URL ini.")
        return
      }

      try {
        console.log(`Mencari data penyelesaian untuk playerId: ${localData.playerId} di roomId: ${roomId}`)
        const { data: completionData, error: completionError } = await supabase
          .from("game_completions")
          .select("*, players!inner(nickname, character_type)")
          .eq("room_id", roomId)
          .eq("player_id", localData.playerId)
          .order("completed_at", { ascending: false })
          .limit(1)
          .single()

        if (completionError || !completionData) {
          console.warn(
            "Gagal mengambil data dari Supabase, menggunakan fallback localStorage.",
            completionError?.message,
          )
          if (localData && localData.health !== undefined && localData.correct !== undefined) {
            const totalQuestions = localData.total || 10
            const data: PlayerData = {
              health: localData.health,
              correct: localData.correct,
              total: totalQuestions,
              eliminated: localData.eliminated || localData.health <= 0,
              perfect: localData.correct === totalQuestions && totalQuestions > 0,
              nickname: localData.nickname,
            }
            setPlayerData(data)
            console.log("Data pemain diatur dari localStorage:", data)
          }
        } else {
          console.log("Data penyelesaian dari Supabase berhasil ditemukan:", completionData)
          const totalQuestions = completionData.total_questions_answered || 10
          const data: PlayerData = {
            health: completionData.final_health,
            correct: completionData.correct_answers,
            total: totalQuestions,
            eliminated: completionData.is_eliminated,
            perfect: completionData.correct_answers === totalQuestions && totalQuestions > 0,
            nickname: completionData.players.nickname,
          }
          setPlayerData(data)
          console.log("Data pemain diatur dari Supabase:", data)

          if (completionData.players?.character_type) {
            const charIndex = Number.parseInt(completionData.players.character_type.replace("robot", "")) - 1
            const gifPath = `/character/player/character${charIndex === 0 ? "" : charIndex}.gif`
            setCharacterGif(gifPath)
            console.log("Character GIF diatur:", gifPath)
          }
        }
      } catch (err: any) {
        console.error("Terjadi kesalahan saat initializePlayerData:", err.message)
        if (localData && localData.health !== undefined && localData.correct !== undefined) {
          const totalQuestions = localData.total || 10
          const data: PlayerData = {
            health: localData.health,
            correct: localData.correct,
            total: totalQuestions,
            eliminated: localData.eliminated || localData.health <= 0,
            perfect: localData.correct === totalQuestions && totalQuestions > 0,
            nickname: localData.nickname,
          }
          setPlayerData(data)
          console.log("Data pemain diatur dari localStorage (fallback):", data)
        } else {
          setError("Terjadi kesalahan saat memuat hasil spesifik Anda.")
        }
      } finally {
        // localStorage.removeItem('lastGameResult');
      }
    },
    [roomCode],
  )
  // =================================================================
  // END: LOGIKA BARU
  // =================================================================

  const fetchInitialData = useCallback(async () => {
    console.log("Memulai fetchInitialData untuk roomCode:", roomCode)
    if (!roomCode) {
      setError("Kode ruangan tidak valid")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data: roomData, error: roomError } = await supabase
        .from("game_rooms")
        .select("id, *") // Ambil semua data ruangan
        .eq("room_code", roomCode)
        .single()

      if (roomError || !roomData) {
        setError(`Ruangan tidak ditemukan: ${roomError?.message || "Ruangan tidak valid"}`)
        setIsLoading(false)
        return
      }

      setRoom(roomData)

      // Panggil inisialisasi data pemain SEBELUM panggilan lainnya
      await initializePlayerData(roomData.id)

      const [
        { data: completionsData, error: completionsError },
        { data: leaderboardData, error: leaderboardError },
        { data: battleStatsData, error: battleStatsError },
        { data: activityData, error: activityError },
      ] = await Promise.all([
        supabase
          .from("game_completions")
          .select(`*, players!inner(nickname, character_type)`)
          .eq("room_id", roomData.id)
          .order("completed_at", { ascending: false })
          .limit(10),
        supabase.rpc("get_room_leaderboard", { p_room_id: roomData.id }),
        supabase.rpc("get_room_battle_stats", { p_room_id: roomData.id }),
        supabase.rpc("get_recent_game_activity", { p_room_id: roomData.id, p_limit: 10 }),
      ])

      if (completionsError) {
        console.warn("Error fetching game completions:", completionsError.message)
        setGameCompletions([])
      } else {
        const formattedCompletions = completionsData.map((completion: any) => ({
          ...completion,
          players: {
            nickname: completion.players?.nickname || "Tidak Dikenal",
            character_type: completion.players?.character_type || "default",
          },
        }))
        setGameCompletions(formattedCompletions)
      }

      if (leaderboardError) {
        console.warn("Error fetching leaderboard:", leaderboardError.message)
        setPlayerStats([])
      } else if (leaderboardData) {
        setPlayerStats(leaderboardData)
      }

      if (battleStatsError) {
        console.warn("Error fetching battle stats:", battleStatsError.message)
        setRoomStats(null)
      } else {
        setRoomStats(battleStatsData[0] || null)
      }

      if (activityError) {
        console.warn("Error fetching recent activities:", activityError.message)
        setRecentActivities([])
      } else {
        setRecentActivities(activityData)
      }
    } catch (err: any) {
      console.error("Fetch initial data error:", err.message)
      setError(err.message || "Gagal memuat data tambahan, menampilkan hasil parsial")
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [roomCode, initializePlayerData])

  const setupRealtimeSubscriptions = useCallback(() => {
    if (!room || !isMountedRef.current) return () => { };

    console.log("Setting up realtime subscriptions for room:", room.id);

    // Debounce the leaderboard update to prevent excessive calls
    const updateLeaderboard = debounce(async () => {
      if (!isMountedRef.current) return;
      const { data: leaderboardData, error } = await supabase.rpc(
        "get_room_leaderboard",
        { p_room_id: room.id }
      );

      if (!error && leaderboardData && isMountedRef.current) {
        setPlayerStats(leaderboardData);
        console.log("Realtime update: player stats", leaderboardData);
      } else if (error) {
        console.warn("Realtime leaderboard error:", error.message);
      }
    }, 500); // Debounce for 500ms to group rapid updates

    // Subscription for game_completions
    const completionsChannel = supabase
      .channel(`completions-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_completions",
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          if (!isMountedRef.current) return;
          const { data: completionsData, error } = await supabase
            .from("game_completions")
            .select(`
            *,
            players!inner(nickname, character_type)
          `)
            .eq("room_id", room.id)
            .order("completed_at", { ascending: false });

          if (!error && completionsData && isMountedRef.current) {
            const formattedCompletions = completionsData.map((completion: any) => ({
              ...completion,
              players: {
                nickname: completion.players?.nickname || "Tidak Dikenal",
                character_type: completion.players?.character_type || "default",
              },
            }));
            setGameCompletions(formattedCompletions);
            console.log("Realtime update: game completions", formattedCompletions);
            // Trigger leaderboard update since game completion affects scores
            updateLeaderboard();
          } else if (error) {
            console.warn("Realtime completions error:", error.message);
          }
        }
      )
      .subscribe();

    // Subscription for players
    const playersChannel = supabase
      .channel(`players-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${room.id}`,
        },
        updateLeaderboard // Directly call debounced leaderboard update
      )
      .subscribe();

    // Subscription for player_health_states
    const healthChannel = supabase
      .channel(`health-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_health_states",
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          if (!isMountedRef.current) return;
          const { data: battleStatsData, error } = await supabase.rpc(
            "get_room_battle_stats",
            { p_room_id: room.id }
          );

          if (!error && battleStatsData && isMountedRef.current) {
            setRoomStats(battleStatsData[0] || null);
            console.log("Realtime update: room stats", battleStatsData[0]);
            // Trigger leaderboard update since health changes may affect scores
            updateLeaderboard();
          } else if (error) {
            console.warn("Realtime battle stats error:", error.message);
          }
        }
      )
      .subscribe();

    // Subscription for player_answers
    const answersChannel = supabase
      .channel(`answers-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_answers",
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          if (!isMountedRef.current) return;
          const { data: activityData, error } = await supabase.rpc(
            "get_recent_game_activity",
            { p_room_id: room.id, p_limit: 10 }
          );

          if (!error && activityData && isMountedRef.current) {
            setRecentActivities(activityData);
            console.log("Realtime update: recent activities", activityData);
            // Trigger leaderboard update since answers affect scores
            updateLeaderboard();
          } else if (error) {
            console.warn("Realtime activities error:", error.message);
          }
        }
      )
      .subscribe();

    // Subscription for player_attacks
    const attacksChannel = supabase
      .channel(`attacks-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_attacks",
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          if (!isMountedRef.current) return;
          const { data: activityData, error } = await supabase.rpc(
            "get_recent_game_activity",
            { p_room_id: room.id, p_limit: 10 }
          );

          if (!error && activityData && isMountedRef.current) {
            setRecentActivities(activityData);
            console.log("Realtime update: recent attacks", activityData);
            // Trigger leaderboard update since attacks may affect scores
            updateLeaderboard();
          } else if (error) {
            console.warn("Realtime attacks error:", error.message);
          }
        }
      )
      .subscribe();

    channelsRef.current = [
      completionsChannel,
      playersChannel,
      healthChannel,
      answersChannel,
      attacksChannel,
    ];

    return () => {
      console.log("Cleaning up realtime subscriptions");
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
      updateLeaderboard.cancel(); // Cancel any pending debounced calls
    };
  }, [room]);

  useEffect(() => {
    isMountedRef.current = true
    fetchInitialData()

    // const timeout = setTimeout(() => {
    //   if (isMountedRef.current && isLoading) {
    //     console.warn("Loading timeout tercapai, paksa render");
    //     setIsLoading(false);
    //     if (!playerData) {
    //       setError("Pemuatan terlalu lama. Data spesifik Anda tidak dapat diambil.");
    //     }
    //   }
    // }, 18000); // Waktu timeout sedikit diperpanjang

    return () => {
      isMountedRef.current = false
      // clearTimeout(timeout);
    }
  }, [fetchInitialData])

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
    if (room) {
      const cleanup = setupRealtimeSubscriptions()
      return cleanup
    }
  }, [room, setupRealtimeSubscriptions])

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

  // ... (Sisa fungsi helper seperti getPlayerRank, getPerformanceTitle, dll, tetap sama)
  const getPlayerRank = () => {
    if (!playerData || playerStats.length === 0) return playerStats.length + 1
    const playerRank = playerStats.find((p) => p.nickname === playerData.nickname)
    return playerRank ? playerRank.rank : playerStats.length + 1
  }

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
        <div className="absolute inset-0 bg-[url('/map1/tombstone.png')] bg-no-repeat bg-center bg-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/10 via-black to-purple-900/10" />
        <div className="text-center z-10">
          <Skull className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
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
        <div className="absolute inset-0 bg-[url('/map1/tombstone.png')] bg-no-repeat bg-center bg-cover opacity-20" />
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
              onClick={fetchInitialData}
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
      <div className="absolute inset-0 bg-[url('/map1/dark-clouds.png')] opacity-30" />
      <div className="absolute inset-0 bg-[url('/map1/fog-texture1.png')] opacity-15 animate-pulse" />
      <div className="absolute inset-0 bg-gradient-to-b from-red-900/10 via-black to-purple-900/10" />

      {/* ... sisa dari JSX (elemen dekoratif, dll.) tetap sama ... */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-red-900 rounded-full opacity-10 blur-xl" />
        <div className="absolute top-1/3 right-20 w-24 h-24 bg-red-900 rounded-full opacity-10 blur-xl" />
        <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-red-900 rounded-full opacity-10 blur-xl" />
        <div className="absolute bottom-1/3 right-1/4 w-20 h-20 bg-red-900 rounded-full opacity-10 blur-xl" />
      </div>

      <div className="absolute top-20 left-10 opacity-20">
        <Image src="/map1/tombstone.png" width={80} height={80} alt="Nisan" />
      </div>
      <div className="absolute top-1/3 right-10 opacity-20">
        <Image src="/map1/dead-tree.png" width={120} height={120} alt="Pohon mati" />
      </div>
      <div className="absolute bottom-20 left-20 opacity-20">
        <Image src="/map1/spooky-tree-2.png" width={100} height={100} alt="Pohon seram" />
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

      <div className="relative z-10 container mx-auto px-4 py-3">
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-1 mb-10"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <Link href={"/"}>
                <h1
                  className="text-xl md:text-4xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                  style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
                >
                  {t("title")}
                </h1>
              </Link>
            </div>

            <div className="flex w-fit gap-2 items-center">
              <img
                src={`/logo/Gemini_Generated_Image_90360u90360u9036.png`}
                alt="Game for Smart Logo"
                className="w-35 md:w-52 lg:w-64 h-auto mr-3"
              />
              {/* Tombol Home */}
              <motion.button
                onClick={() => router.push("/")}
                whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
                whileTap={{ scale: 0.95 }}
                // Ganti padding & tambahkan aria-label
                className="bg-red-800 text-white p-2 border-2 border-red-600 rounded-md"
                aria-label={t("homeButton")} // Penting untuk aksesibilitas
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
            <Skull className="w-12 h-12 text-red-500 animate-pulse" />
            <h1
              className={`mx-3 text-5xl font-bold font-mono tracking-wider transition-all duration-150 animate-pulse text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("result.title")}
            </h1>
            <Skull className="w-12 h-12 text-red-500 animate-pulse" />
          </motion.div>
        </motion.header>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-6"
          >
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <HorrorCard variant="blood" glowing animated className="max-w-2xl mx-auto mb-8">
            <div className="p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-1/4 w-1 h-16 bg-red-900/70" />
              <div className="absolute top-0 right-1/3 w-1 h-10 bg-red-900/70" />

              <div className="relative z-10">
                <h2 className="text-3xl font-bold text-white mb-2 font-horror tracking-wider text-red-500">
                  {getPerformanceTitle()}
                </h2>

                <p className="text-gray-300 mb-6 italic font-mono text-sm">{getPerformanceMessage()}</p>

                <div className="mb-6 flex justify-center">
                  <Image
                    src={characterGif || "/placeholder.svg"}
                    width={120}
                    height={120}
                    alt="Karakter"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
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

        {playerStats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <HorrorCard variant="curse" glowing className="max-w-4xl mx-auto mb-8">
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-4 font-horror tracking-wider flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                  {t("result.titleLeaderboard")}
                </h3>

                <div className="space-y-2">
                  <AnimatePresence>
                    {playerStats.slice(0, 10).map((player, index) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`flex items-center justify-between p-3 rounded-lg border ${player.nickname === playerData.nickname
                          ? "bg-purple-900/30 border-purple-700 ring-2 ring-purple-500"
                          : index === 0
                            ? "bg-yellow-900/20 border-yellow-800"
                            : "bg-gray-900/50 border-gray-800"
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? "bg-yellow-600 text-white" : "bg-gray-700 text-gray-300"
                              }`}
                          >
                            {player.rank}
                          </div>

                          <div>
                            <div className="text-white font-mono tracking-wider">{player.nickname}</div>
                            <div className="text-xs text-gray-400">
                              {t("result.correct", { count: player.correct_answers })}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-bold text-white font-mono">{player.score}</div>
                          <div className="text-xs text-gray-400 tracking-widest">{t("result.points")}</div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </HorrorCard>
          </motion.div>
        )}

        <motion.div
          className="mt-12 text-center text-gray-500 text-xs font-mono tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <p>{t("result.adventureAwait")}</p>
          <p className="mt-1">{t("result.braveryRemembered")}</p>
        </motion.div>
      </div>
    </div>
  )
}
