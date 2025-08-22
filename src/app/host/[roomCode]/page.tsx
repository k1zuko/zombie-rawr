"use client"

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Play, Copy, Check, Clock, Trophy, Zap, Wifi, Skull, Bone, HeartPulse, Trash2 } from "lucide-react";
import { supabase, type Player } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { syncServerTime, calculateCountdown } from "@/lib/server-time"
import { useTranslation } from "react-i18next";
import { Toaster, toast } from "react-hot-toast";
import { useHostGuard } from "@/lib/host-guard";


const validChaserTypes = ["zombie", "monster1", "monster2", "monster3", "darknight"] as const
type ChaserType = (typeof validChaserTypes)[number]

interface GameRoom {
  quiz_id(arg0: string, quiz_id: any): { data: any; error: any } | PromiseLike<{ data: any; error: any }>
  id: string
  room_code: string
  title: string | null
  status: "waiting" | "playing" | "finished"
  max_players: number
  duration: number | null
  question_count: number | null
  current_phase: "lobby" | "quiz" | "minigame" | "finished"
  questions: any[] | null
  created_at: string
  updated_at: string
  chaser_type: ChaserType
  countdown_start: string
}

export default function HostPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const roomCode = params.roomCode as string

  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [copied, setCopied] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connecting")
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flickerText, setFlickerText] = useState(true)
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([])
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; nickname: string } | null>(null);

  useHostGuard(roomCode)

  const kickPlayer = async (playerId: string, nickname: string) => {
    console.log("Kick player called for:", playerId, nickname);
    setSelectedPlayer({ id: playerId, nickname });
    setKickDialogOpen(true);
    console.log("kickDialogOpen set to:", true);
  };

  const confirmKickPlayer = async () => {
    if (!selectedPlayer || !selectedPlayer.id) {
      toast.error(t("kickPlayerError"));
      setKickDialogOpen(false);
      setSelectedPlayer(null);
      return;
    }
    try {
      console.log("Attempting to kick player:", selectedPlayer);
      const { error } = await supabase
        .from("players")
        .delete()
        .eq("id", selectedPlayer.id);
      if (error) {
        console.error("Supabase error:", error);
        toast.error(t("kickPlayerError"));
      } else {
        toast.success(t("kickPlayerSuccess", { nickname: selectedPlayer.nickname }));
        // Panggil fetchPlayers secara manual setelah kick berhasil
        if (room?.id) {
          await fetchPlayers(room.id);
        }
        // Tunggu sebentar untuk memastikan real-time sync
        setTimeout(() => {
          if (room?.id) fetchPlayers(room.id);
        }, 500);
      }
    } catch (error) {
      console.error("Kick player error:", error);
      toast.error(t("kickPlayerError"));
    } finally {
      setKickDialogOpen(false);
      setSelectedPlayer(null);
    }
  };

  const fetchRoom = useCallback(async () => {
    if (!roomCode) return

    try {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("*, chaser_type, countdown_start")
        .eq("room_code", roomCode)
        .single()

      if (error || !data) {
        console.error("Room tidak ditemukan:", error)
        router.push("/")
        return
      }

      const fetchedChaserType = validChaserTypes.includes(data.chaser_type) ? data.chaser_type : "zombie"
      setRoom({ ...data, chaser_type: fetchedChaserType })
      return data
    } catch (error) {
      console.error("Error mengambil room:", error)
      router.push("/")
    }
  }, [roomCode, router])

  const fetchPlayers = useCallback(async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .order("joined_at", { ascending: true })

      if (error) {
        console.error("Error mengambil pemain:", error)
        return
      }

      setPlayers(data || [])
    } catch (error) {
      console.error("Error mengambil pemain:", error)
    }
  }, [])

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true)
      const roomData = await fetchRoom()
      if (roomData) {
        await fetchPlayers(roomData.id)
      }
      setIsLoading(false)
    }

    initializeData()
  }, [fetchRoom, fetchPlayers])

  useEffect(() => {
    if (!room?.id) return

    const channel = supabase
      .channel(`room_${room.id}_host`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          fetchPlayers(room.id)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const newRoom = payload.new as GameRoom
          const updatedChaserType = validChaserTypes.includes(newRoom.chaser_type) ? newRoom.chaser_type : "zombie"
          setRoom({ ...newRoom, chaser_type: updatedChaserType })
          if (newRoom.current_phase === "quiz") {
            router.push(`/game/${roomCode}/host`)
          }
        },
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected")
        } else if (status === "CHANNEL_ERROR") {
          setConnectionStatus("disconnected")
        } else {
          setConnectionStatus("connecting")
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [room?.id, fetchPlayers, roomCode, router])

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

  useEffect(() => {
    const flickerInterval = setInterval(
      () => {
        setFlickerText((prev) => !prev)
      },
      100 + Math.random() * 150,
    )

    return () => {
      clearInterval(flickerInterval)
    }
  }, [])

  useEffect(() => {
    if (!room?.countdown_start) {
      setCountdown(null)
      return
    }

    const updateCountdown = () => {
      const remaining = calculateCountdown(room.countdown_start, 10000)
      console.log("⏰ HostPage: Server-synced countdown:", remaining)
      setCountdown(remaining)

      if (remaining <= 0) {
        setCountdown(null)
        setIsStarting(false)
        return false
      }
      return true
    }

    // Update immediately
    if (updateCountdown()) {
      // Use 100ms intervals for smooth countdown
      const timer = setInterval(() => {
        if (!updateCountdown()) {
          clearInterval(timer)
        }
      }, 100)

      return () => clearInterval(timer)
    } else {
      setCountdown(null)
      setIsStarting(false)
    }
  }, [room?.countdown_start])

  const copyRoomCode = async () => {
    if (typeof window === "undefined") return
    const joinLink = `${window.location.origin}/?code=${roomCode}`
    await navigator.clipboard.writeText(joinLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyRoomCode1 = async () => {
    if (typeof window === "undefined") return;

    const joinLink = `${window.location.origin}/?code=${roomCode}`;
    const inviteMessage = t("inviteMessage", {
      roomCode: roomCode,
      joinLink: joinLink,
    });

    await navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = async () => {
    if (!room || players.length === 0) {
      alert("Gagal memulai game: Tidak ada ruangan atau pemain.")
      return
    }

    setIsStarting(true)

    try {
      // Sync server time before starting countdown
      await syncServerTime()

      // Use server RPC to set countdown_start with server time
      const { error: countdownError } = await supabase.rpc("set_countdown_start", {
        room_id: room.id,
      })

      if (countdownError) {
        console.warn("RPC failed, using fallback:", countdownError)
        // Fallback to client time if RPC fails
        const { error: fallbackError } = await supabase
          .from("game_rooms")
          .update({
            countdown_start: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", room.id)

        if (fallbackError) {
          throw new Error(`Gagal memulai countdown: ${fallbackError.message}`)
        }
      }

      // Set initial countdown display
      setCountdown(10)

      // Wait for countdown to complete, then start the game
      setTimeout(async () => {
        try {
          // ... existing game start logic ...
          const { data: questions, error: quizError } = await supabase
            .from("quiz_questions")
            .select("id, question_type, question_text, image_url, options, correct_answer")
            .eq("quiz_id", room.quiz_id)

          if (quizError || !questions || questions.length === 0) {
            throw new Error(`Gagal mengambil soal: ${quizError?.message || "Bank soal kosong"}`)
          }

          const selectedQuestionCount = room.question_count || 20
          const shuffledQuestions = questions
            .map((value) => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value)
            .slice(0, Math.min(selectedQuestionCount, questions.length))

          const formattedQuestions = shuffledQuestions.map((q, index) => ({
            id: q.id,
            question_index: index + 1,
            question_type: q.question_type,
            question_text: q.question_text,
            image_url: q.image_url,
            options: q.options,
            correct_answer: q.correct_answer,
          }))

          const validatedChaserType = validChaserTypes.includes(room.chaser_type) ? room.chaser_type : "zombie"
          const { error: roomError } = await supabase
            .from("game_rooms")
            .update({
              status: "playing",
              current_phase: "quiz",
              questions: formattedQuestions,
              duration: room.duration || 600,
              chaser_type: validatedChaserType,
              game_start_time: new Date().toISOString(),
              countdown_start: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", room.id)

          if (roomError) {
            throw new Error(`Gagal memulai game: ${roomError.message}`)
          }

          const { error: stateError } = await supabase.from("game_states").insert({
            room_id: room.id,
            phase: "quiz",
            time_remaining: room.duration || 600,
            lives_remaining: 3,
            target_correct_answers: Math.max(5, players.length * 2),
            current_correct_answers: 0,
            current_question_index: 0,
            status: "playing",
            created_at: new Date().toISOString(),
          })

          if (stateError) {
            throw new Error(`Gagal membuat status permainan: ${stateError.message}`)
          }

          router.push(`/game/${roomCode}/host`)
        } catch (error) {
          console.error("Error memulai game:", error)
          alert("Gagal memulai game: " + (error instanceof Error ? error.message : "Kesalahan tidak diketahui"))
          setIsStarting(false)
          setCountdown(null)
        }
      }, 10000)
    } catch (error) {
      console.error("Error memulai countdown:", error)
      alert("Gagal memulai countdown: " + (error instanceof Error ? error.message : "Kesalahan tidak diketahui"))
      setIsStarting(false)
      setCountdown(null)
    }
  }
// 
  useEffect(() => {
    syncServerTime()
  }, [])

  const characterOptions = [
    { value: "robot1", name: "Hijau", gif: "/character/player/character.gif", alt: "Karakter Hijau" },
    { value: "robot2", name: "Biru", gif: "/character/player/character1.gif", alt: "Karakter Biru" },
    { value: "robot3", name: "Merah", gif: "/character/player/character2.gif", alt: "Karakter Merah" },
    { value: "robot4", name: "Ungu", gif: "/character/player/character3.gif", alt: "Karakter Ungu" },
    { value: "robot5", name: "Oranye", gif: "/character/player/character4.gif", alt: "Karakter Oranye" },
    { value: "robot6", name: "Kuning", gif: "/character/player/character5.gif", alt: "Karakter Kuning" },
    { value: "robot7", name: "Abu-abu", gif: "/character/player/character6.gif", alt: "Karakter Abu-abu" },
    { value: "robot8", name: "Pink", gif: "/character/player/character7.gif", alt: "Karakter Pink" },
    { value: "robot9", name: "Cokelat", gif: "/character/player/character8.gif", alt: "Karakter Cokelat" },
    { value: "robot10", name: "Emas", gif: "/character/player/character9.gif", alt: "Karakter Emas" },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-400 text-xl font-mono">Room tidak ditemukan</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      <audio src="/musics/background-music-room.mp3" autoPlay loop />
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5">
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
            {Math.random() > 0.5 ? <Skull /> : <Bone />}
          </div>
        ))}
      </div>

      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJzY3JhdGNoZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48cGF0aCBkPSJNMCAwLDUwMCA1MDAiIHN0cm9rZT0icmdiYSgyNTUsMCwwLDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48cGF0aCBkPSJNMCAxMDBMNTAwIDYwMCIgc3Ryb2tlPSJyZ2JhKDI1NSwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDIwMEw1MDAgNzAwIiBzdHJva2U9InJnYmEoMjU1LDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NjcmF0Y2hlcykiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] opacity-20" />

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

      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              className="text-[20rem] md:text-[30rem] font-mono font-bold text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]"
            >
              {countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`relative z-10 container mx-auto px-4 py-4 max-w-6xl ${countdown !== null ? "hidden" : ""}`}>
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center py-4 mb-6">
            <HeartPulse className="w-12 h-12 text-red-500 mr-4 animate-pulse" />
            <h1
              className={`text-5xl md:text-6xl font-bold font-mono tracking-widest transition-all duration-150 ${flickerText ? "text-red-500 opacity-100" : "text-red-900 opacity-30"
                } drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("title")}
            </h1>
            <HeartPulse className="w-12 h-12 text-red-500 ml-4 animate-pulse" />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-4 bg-black/40 border border-red-900/50 rounded-lg p-4 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]"

          >

            <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
              <DialogTrigger asChild>
                <motion.div
                  className="w-36 h-16 md:w-24 md:h-24 border bg-white border-red-900/50 rounded overflow-hidden p-1 cursor-pointer hover:scale-105 transition-transform"
                  title="Klik untuk memperbesar QR"
                >
                  <QRCode
                    value={`${window.location.origin}/?code=${roomCode}`}
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox={`0 0 256 256`}
                  />
                </motion.div>
              </DialogTrigger>

              <DialogContent
                className="w-[95vw] max-w-6xl h-[90vh] 
             bg-black/95 text-white 
             border border-red-500/50 
             rounded-3xl p-10 
             shadow-[0_0_50px_rgba(255,0,0,0.6)] 
             flex flex-col items-center gap-10 overflow-auto"
              >
                {/* Header */}
                <DialogHeader>
                  <DialogTitle className="text-4xl text-center font-bold text-red-400 font-mono tracking-widest drop-shadow-[0_0_12px_rgba(255,0,0,0.7)]">
                    {t("inviteToPlay")}
                  </DialogTitle>
                </DialogHeader>

                {/* QR dalam dialog */}
                <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-xl flex items-center justify-center">
                  <QRCode
                    value={`${window.location.origin}/?code=${roomCode}`}
                    size={340}
                    style={{ height: "auto", width: "100%" }}
                  />
                </div>

                {/* Link join */}
                            <div className="text-center">
              
              <div className="text-2xl md:text-6xl font-mono font-bold text-red-500 tracking-wider">{roomCode}</div>
            </div>
                <div className="flex items-center w-full max-w-3xl bg-black/50 p-6 rounded-2xl border border-red-500/30">
                  <div className="flex-grow text-center">
                    
                    <div className="text-red-400 font-mono mb-1"></div>
                    <div className="text-sm font-mono font-bold text-red-500 tracking-widest break-words">
                      {`${window.location.origin}/?code=${roomCode}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={copyRoomCode1}
                    className="ml-4 text-red-400 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(255,0,0,0.6)] rounded-xl p-4 transition-all"
                    aria-label="Salin tautan game"
                  >
                    <motion.div
                      key={copied ? "check" : "copy"}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      {copied ? <Check className="w-8 h-8" /> : <Copy className="w-8 h-8" />}
                    </motion.div>
                  </Button>
                </div>
              </DialogContent>


            </Dialog>

            <div className="text-center">
              <div className="text-red-400 text-sm font-mono">{t("roomCode")}</div>
              <div className="text-2xl md:text-3xl font-mono font-bold text-red-500 tracking-wider">{roomCode}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyRoomCode}
              className="text-red-400 hover:bg-red-500/20 rounded-xl"
            >
              <motion.div
                key={copied ? "check" : "copy"}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </motion.div>
            </Button>
            <div className="flex items-center gap-2">
              <Wifi
                className={`w-4 h-4 ${connectionStatus === "connected"
                  ? "text-red-400"
                  : connectionStatus === "connecting"
                    ? "text-yellow-400"
                    : "text-red-900"
                  }`}
              />
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-6 mb-8"
        >
          <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            <CardContent className="text-center">
              <Users className="w-6 h-6 md:w-8 md:h-8 text-red-500 mx-auto mb-2" />
              <motion.div
                key={players.length}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-2xl md:text-xl font-bold text-red-500 mb-1 font-mono"
              >
                {players.length}/{room.max_players}
              </motion.div>
              <div className="text-red-400 text-sm font-mono">{t("players")}</div>
            </CardContent>
          </Card>
          <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            <CardContent className="text-center">
              <Clock className="w-6 h-6 md:w-8 md:h-8 text-red-500 mx-auto mb-2" />
              <div className="text-xl font-bold text-red-500 mb-1 font-mono">
                {Math.floor((room.duration || 600) / 60)}:{((room.duration || 600) % 60).toString().padStart(2, "0")}
              </div>
              <div className="text-red-400 text-sm font-mono">{t("duration")}</div>
            </CardContent>
          </Card>
          <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            <CardContent className="text-center">
              <Trophy className="w-6 h-6 md:w-8 md:h-8 text-red-500 mx-auto mb-2" />
              <div className="text-xl font-bold text-red-500 mb-1 font-mono">{room.question_count || 20}</div>
              <div className="text-red-400 text-sm font-mono">{t("question")}</div>
            </CardContent>
          </Card>
        </motion.div>

<motion.div
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.4 }}
  className="mb-12"
>
  <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
    <CardHeader>
      <CardTitle className="text-red-500 text-xl md:text-2xl font-mono flex items-center gap-3">
        <Users className="w-5 h-5 md:w-6 md:h-6" />
        {t("players")}
        <Badge variant="secondary" className="bg-red-900/50 text-red-400 font-mono">
          {players.length} {t("online")}
        </Badge>
        {connectionStatus === "connected" && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            className="w-2 h-2 bg-red-400 rounded-full"
          />
        )}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <AnimatePresence mode="popLayout">
        {players.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            >
              <Users className="w-12 h-12 md:w-16 md:h-16 text-red-900/50 mx-auto mb-4" />
            </motion.div>
            <p className="text-red-400 text-lg font-mono">{t("waitingHost")}</p>
            <p className="text-red-400/80 text-sm font-mono">{t("shareCode")}</p>
          </motion.div>
        ) : (
          <motion.div
            key="players"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
            layout
            transition={{ layout: { duration: 0.3, type: "spring", stiffness: 100, damping: 20 } }}
          >
            <AnimatePresence>
              {players.map((player, index) => {
                const selectedCharacter = characterOptions.find(
                  (char) => char.value === player.character_type
                );

                return (
                  <motion.div
                    key={player.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 0.5,
                      x: Math.random() > 0.5 ? 200 : -200,
                      rotate: Math.random() * 360,
                      transition: { duration: 0.5, ease: "easeIn" },
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                      delay: index * 0.05,
                    }}
                    whileHover={{ scale: 1.05 }}
                    className="bg-black/40 border border-red-900/50 rounded-lg p-4 text-center hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] relative"
                  >
                    {!player.is_host && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => kickPlayer(player.id, player.nickname)}
                        className="absolute top-0 right-15 bg-black/40 text-red-500 hover:bg-red-700/50 p-3 relative"
                        aria-label={t("kickPlayer", { nickname: player.nickname })}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="absolute inset-0" style={{ zIndex: -1 }} />
                      </Button>
                    )}
                    <motion.div
                      className="mb-2"
                      animate={{
                        rotate: [0, 10, -10, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: index * 0.2,
                      }}
                    >
                      {selectedCharacter ? (
                        <img
                          src={selectedCharacter.gif}
                          alt={selectedCharacter.alt}
                          className="w-15 mx-auto"
                        />
                      ) : (
                        player.character_type
                      )}
                    </motion.div>
                    <div className="text-red-500 font-medium text-sm truncate mb-1 font-mono">{player.nickname}</div>
                    {player.is_host && (
                      <Badge variant="secondary" className="text-xs bg-red-900 text-red-400 font-mono">
                        {t("host")}
                      </Badge>
                    )}
                    {/* <div className="text-red-400/80 text-xs mt-1 font-mono">
                      {new Date(player.joined_at).toLocaleTimeString()}
                    </div> */}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </CardContent>
  </Card>
</motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center"
        >
          <Button
            onClick={startGame}
            disabled={players.length === 0 || isStarting || countdown !== null}
            className="relative overflow-hidden bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-mono text-lg md:text-xl px-8 md:px-10 py-4 md:py-6 rounded-lg border-2 border-red-700 shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group w-full sm:w-auto"
          >
            <span className="relative z-10 flex items-center">
              {isStarting || countdown !== null ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  className="w-5 h-5 mr-2"
                >
                  <Zap className="w-5 h-5" />
                </motion.div>
              ) : (
                <Play className="w-5 h-5 mr-2" />
              )}
              {countdown !== null
                ? t("startGame.start?")
                : isStarting
                  ? t("startGame.start?")
                  : t("startGame.start")}

            </span>
            <span className="absolute inset-0 bg-red-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
            <span className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
          </Button>
        </motion.div>
      </div>
      <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
        <DialogContent className="bg-black/95 border border-red-600/70 text-red-400 rounded-xl shadow-[0_0_30px_rgba(255,0,0,0.4)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-500">
              {t("kickPlayerConfirm", { nickname: selectedPlayer?.nickname })}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter className="mt-4 flex justify-end space-x-2">
            <Button
              variant="ghost"
              onClick={() => setKickDialogOpen(false)}
              className="text-gray-400 hover:text-red-400 hover:bg-red-950/40"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={confirmKickPlayer}
              className="bg-red-600 hover:bg-red-700 text-white shadow-[0_0_10px_rgba(255,0,0,0.6)]"
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster position="top-right" toastOptions={{ style: { background: "#1a0000", color: "#ff4444", border: "1px solid #ff0000" } }} />

      <style jsx global>{`
        @keyframes fall {
          to {
            transform: translateY(100vh);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(26, 0, 0, 0.8);
          border-left: 2px solid rgba(255, 0, 0, 0.3);
          box-shadow: inset 0 0 6px rgba(255, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b0000, #ff0000);
          border-radius: 4px;
          border: 1px solid rgba(255, 0, 0, 0.5);
          box-shadow: 0 0 6px rgba(255, 0, 0, 0.7);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #ff0000, #8b0000);
          box-shadow: 0 0 8px rgba(255, 0, 0, 0.9);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #ff0000 rgba(26, 0, 0, 0.8);
        }
      `}</style>
    </div>
  )
}