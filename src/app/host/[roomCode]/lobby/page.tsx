"use client"

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Play, Copy, Check, Clock, List, Skull, Bone, HeartPulse, Trash2, Maximize2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { syncServerTime, calculateCountdown } from "@/lib/server-time"
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useHostGuard } from "@/lib/host-guard";
import { createPortal } from "react-dom";
import Link from "next/link";

const validChaserTypes = ["zombie", "monster1", "monster2", "monster3", "darknight"] as const
type ChaserType = (typeof validChaserTypes)[number]

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

interface GameRoom {
  id: string
  room_code: string
  host_id: string | null
  title: string  // NOT NULL per schema
  status: "waiting" | "playing" | "finished"
  max_players: number
  duration: number
  quiz_id: string | null
  chaser_type: ChaserType
  difficulty_level: string
  created_at: string
  updated_at: string
  game_start_time: string | null
  countdown_start: string | null
  question_count: number
  embedded_questions: any[]  // JSONB per schema
  players: EmbeddedPlayer[]  // JSONB per schema
}

function QRModal({
  open,
  onClose,
  roomCode
}: {
  open: boolean
  onClose: () => void
  roomCode: string
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (typeof document === "undefined") return null
  if (!open) return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.section
        initial={{ y: 20, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 10, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 28 }}
        className="relative z-10 w-full max-w-sm sm:max-w-md bg-black/95 text-white rounded-2xl p-4 sm:p-6 overflow-hidden shadow-[0_0_60px_rgba(255,0,0,0.45)] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col items-center justify-center gap-4 py-4" style={{ minHeight: 300 }}>
          <div className="w-full bg-white rounded-lg p-2 sm:p-3 flex items-center justify-center">
            <div className="w-40 h-40 flex items-center justify-center sm:w-48 sm:h-48 md:w-64 md:h-64">
              <QRCode
                value={`${window.location.origin}/?code=${roomCode}`}
                style={{ width: "100%", height: "100%" }}
                viewBox="0 0 256 256"
              />
            </div>
          </div>
          <div className="text-center text-sm sm:text-base text-red-400">
            <p>Scan QR Code untuk bergabung</p>
          </div>
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            Tutup
          </Button>
        </div>
      </motion.section>
    </motion.div>,
    document.body
  )
}

export default function HostPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const roomCode = params.roomCode as string

  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<EmbeddedPlayer[]>([])
  const [copied, setCopied] = useState(false)
  const [copied1, setCopied1] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connecting")
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flickerText, setFlickerText] = useState(true)
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([])
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [kickDialogOpen, setKickDialogOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<{ player_id: string; nickname: string } | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useHostGuard(roomCode)

  const kickPlayer = async (playerId: string, nickname: string) => {
    console.log("Kick player called for:", playerId, nickname)
    setSelectedPlayer({ player_id: playerId, nickname })
    setKickDialogOpen(true)
    console.log("kickDialogOpen set to:", true)
  }

  const confirmKickPlayer = async () => {
    if (!selectedPlayer || !selectedPlayer.player_id || !room?.id) {
      toast.error(t("kickPlayerError"))
      setKickDialogOpen(false)
      setSelectedPlayer(null)
      return
    }
    try {
      console.log("Attempting to kick player:", selectedPlayer)
      const { data: currentRoom, error: fetchError } = await supabase
        .from("game_rooms")
        .select("players")
        .eq("id", room.id)
        .single();

      if (fetchError || !currentRoom) {
        console.error("Error fetching room for kick:", fetchError);
        toast.error(t("kickPlayerError"));
        setKickDialogOpen(false)
        setSelectedPlayer(null)
        return;
      }

      const currentPlayers = currentRoom.players || [];
      const newPlayers = currentPlayers.filter((p: EmbeddedPlayer) => p.player_id !== selectedPlayer.player_id);

      const { error: updateError } = await supabase
        .from("game_rooms")
        .update({ 
          players: newPlayers,
          updated_at: new Date().toISOString()
        })
        .eq("id", room.id);

      if (updateError) {
        console.error("Error updating room players:", updateError);
        toast.error(t("kickPlayerError"));
      } else {
        toast.success(t("kickPlayerSuccess", { nickname: selectedPlayer.nickname }))
        await fetchRoom();
      }
    } catch (error) {
      console.error("Kick player error:", error)
      toast.error(t("kickPlayerError"))
    } finally {
      setKickDialogOpen(false)
      setSelectedPlayer(null)
    }
  }

  const fetchRoom = useCallback(async () => {
    if (!roomCode) return
    try {
      const { data, error } = await supabase
        .from("game_rooms")
        .select(`
          *,
          players,
          embedded_questions
        `)
        .eq("room_code", roomCode)
        .single()

      if (error || !data) {
        console.error("Room tidak ditemukan:", error)
        router.push("/")
        return null
      }

      const fetchedChaserType = validChaserTypes.includes(data.chaser_type) ? data.chaser_type : "zombie"
      const updatedRoom: GameRoom = { 
        ...data, 
        chaser_type: fetchedChaserType,
        players: data.players || [],
        embedded_questions: data.embedded_questions || []
      }
      setRoom(updatedRoom)
      
      setPlayers(updatedRoom.players || [])

      return updatedRoom
    } catch (error) {
      console.error("Error mengambil room:", error)
      router.push("/")
      return null
    }
  }, [roomCode, router])

  useEffect(() => {
    const initializeData = async () => {
      await fetchRoom()
    }
    initializeData()
  }, [fetchRoom])

useEffect(() => {
  if (!room?.id) return;
  const channel = supabase
    .channel(`room_${room.id}`)  // Hapus _host, pakai ini aja
    .on(
      "postgres_changes",
      {
        event: "UPDATE",  // Fokus ke UPDATE (player join biasanya UPDATE JSONB players)
        schema: "public",
        table: "game_rooms",
        filter: `id=eq.${room.id}`,
      },
      (payload) => {
        console.log("Realtime UPDATE payload:", payload);  // Debug: Cek apakah ini jalan
        fetchRoom();  // Selalu fetch ulang, lebih aman daripada parse payload
      },
    )
    .subscribe((status, err) => {
      console.log("Subscription status:", status, err);  // Debug error
      if (status === "SUBSCRIBED") {
        setConnectionStatus("connected");
      } else if (err) {
        console.error("Realtime err:", err);
        setConnectionStatus("disconnected");
      } else {
        setConnectionStatus("connecting");
      }
    });

  return () => {
    channel.unsubscribe();
  };
}, [room?.id, fetchRoom]);

  useEffect(() => {
    const generateBlood = () => {
      const newBlood = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        speed: 2 + Math.random() * 1.5,
        delay: Math.random() * 3,
      }))
      setBloodDrips(newBlood)
    }
    generateBlood()
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
      setCountdown(null);
      setIsStarting(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const updateCountdown = () => {
      const remaining = calculateCountdown(room.countdown_start, 10000)
      console.log("⏰ HostPage: Server-synced countdown:", remaining)
      setCountdown(remaining)

      if (remaining <= 0) {
        setCountdown(null)
        setIsStarting(false)
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return false
      }
      return true
    }

    const initialRemaining = updateCountdown()
    if (initialRemaining) {
      timerRef.current = setInterval(updateCountdown, 100)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [room?.countdown_start])

  const copyRoomCode = async () => {
    if (typeof window === "undefined") return
    await navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLinkRoomCode = async () => {
    if (typeof window === "undefined") return
    const joinLink = `${window.location.origin}/?code=${roomCode}`
    await navigator.clipboard.writeText(joinLink)
    setCopied1(true)
    setTimeout(() => setCopied1(false), 2000)
  }

  const startGame = async () => {
    if (!room || players.length === 0) {
      toast.error("Gagal memulai game: Tidak ada ruangan atau pemain.")
      return
    }

    setIsStarting(true)

    try {
      await syncServerTime()
      const { error: countdownError } = await supabase
        .from("game_rooms")
        .update({
          countdown_start: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id);

      if (countdownError) {
        console.warn("Update failed:", countdownError)
        throw new Error(`Gagal memulai countdown: ${countdownError.message}`)
      }

      setCountdown(10)

      setTimeout(async () => {
        try {
          let questions = room.embedded_questions || [];
          if (!questions || questions.length === 0) {
            const { data: quizData, error: quizError } = await supabase
              .from("quizzes")
              .select("questions")
              .eq("id", room.quiz_id)
              .single();

            if (quizError || !quizData || !quizData.questions || quizData.questions.length === 0) {
              throw new Error(`Gagal mengambil soal: ${quizError?.message || "Bank soal kosong"}`)
            }

            questions = quizData.questions;
          }

          const selectedQuestionCount = room.question_count || 20
          const shuffledQuestions = questions
            .map((value: any) => ({ value, sort: Math.random() }))
            .sort((a: any, b: any) => a.sort - b.sort)
            .map(({ value }: any) => value)
            .slice(0, Math.min(selectedQuestionCount, questions.length))

          const formattedQuestions = shuffledQuestions.map((q: any, index: number) => ({
            id: q.id || `q_${index}`,
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
              embedded_questions: formattedQuestions,
              chaser_type: validatedChaserType,
              game_start_time: new Date().toISOString(),
              countdown_start: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", room.id)

          if (roomError) {
            throw new Error(`Gagal memulai game: ${roomError.message}`)
          }

          router.push(`/host/${roomCode}/game`)
        } catch (error) {
          console.error("Error memulai game:", error)
          toast.error("Gagal memulai game: " + (error instanceof Error ? error.message : "Kesalahan tidak diketahui"))
          setIsStarting(false)
          setCountdown(null)
        }
      }, 10000)
    } catch (error) {
      console.error("Error memulai countdown:", error)
      toast.error("Gagal memulai countdown: " + (error instanceof Error ? error.message : "Kesalahan tidak diketahui"))
      setIsStarting(false)
      setCountdown(null)
    }
  }

  useEffect(() => {
    syncServerTime()
  }, [])

  const characterOptions = [
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

  if (!room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-red-400 text-xl font-mono text-center">Room tidak ditemukan</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      <div className="absolute top-4 left-4 z-20 hidden md:block">
        <Link href={"/"}>
          <h1
            className="text-3xl md:text-5xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
            style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
          >
            {t("title")} {/* QuizRush */}
          </h1>
        </Link>
      </div>
      <div className="absolute top-4 right-4 z-20 hidden md:block">
        <img
        src={`/logo/gameforsmartlogo-horror.png`}
          alt="Game for Smart Logo"
          className="w-40 md:w-48 lg:w-56 h-auto"
        />
      </div>
      <audio src="/musics/background-music-room.mp3" autoPlay loop muted />
      <div className="absolute inset-0 z-0" style={{ backgroundImage: "url('/background/21.gif')", backgroundSize: "cover", backgroundPosition: "center" }}></div>
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5">
        <div className="absolute inset-0 opacity-20">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-red-900 rounded-full mix-blend-multiply blur-xl"
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
        <motion.div
          key={drip.id}
          initial={{ y: -100 }}
          animate={{ y: "100vh" }}
          transition={{ duration: drip.speed, delay: drip.delay, ease: "linear", repeat: Infinity }}
          className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
          style={{ left: `${drip.left}%`, opacity: 0.6 + Math.random() * 0.2 }}
        />
      ))}

      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute text-red-900/20 animate-float hidden sm:block"
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

      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJzY3JhdGNoZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48cGF0aCBkPSJNMCAwLDUwMCA1MDAiIHN0cm9rZT0icmdiYSgyNTUsMCwwLDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48cGF0aCBkPSJNMCAxMDBLNTAwIDYwMCIgc3Ryb2tlPSJyZ2JhKDI1NSwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDIwMEw1MDAgNzAwIiBzdHJva2U9InJnYmEoMjU1LDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NjcmF0Y2hlcykiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] opacity-20" />

      <div className="absolute top-0 left-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 right-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-20">
        <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
      </div>

      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              className="text-[8rem] sm:text-[12rem] md:text-[16rem] lg:text-[20rem] xl:text-[30rem] font-mono font-bold text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] flex-shrink-0"
            >
              {countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`relative z-10 mx-auto p-4 sm:p-6 lg:p-7 ${countdown !== null ? "hidden" : ""}`}>
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-2 sm:gap-4 mb-6 sm:mb-10 max-w-7xl mx-auto"
        >
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
            className="flex justify-center items-center text-center mt-10"
          >
           
            <h1
              className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-6xl font-bold font-mono tracking-wider transition-all duration-150 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse ${flickerText ? 'opacity-100' : 'opacity-50'}`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("hostRoomTitle")}
            </h1>
           
          </motion.div>
        </motion.header>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6 lg:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-3 lg:grid-cols-1 gap-2 sm:gap-3 lg:gap-4 lg:col-span-1"
          >
            <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
              <CardContent>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-red-500 flex-shrink-0" />
                  <div>
                    <motion.div
                      key={players.length}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className="text-lg sm:text-xl md:text-2xl lg:text-3xl lg:text-4xl font-bold text-red-500 font-mono"
                    >
                      {players.length}
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
              <CardContent>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-red-500 flex-shrink-0" />
                  <div>
                    <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl lg:text-4xl font-bold text-red-500 font-mono">
                      {Math.floor((room.duration || 600) / 60)}:{((room.duration || 600) % 60).toString().padStart(2, "0")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
              <CardContent>
                <div className="flex items-center gap-1 sm:gap-2">
                  <List className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-red-500 flex-shrink-0" />
                  <div>
                    <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl lg:text-4xl font-bold text-red-500 font-mono">{room.question_count || 20}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
            className="relative flex flex-col lg:flex-row items-stretch lg:items-center bg-black/40 border border-red-900/50 rounded-lg p-4 lg:p-6 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] lg:col-span-4 gap-4 lg:gap-6"
          >
                      <motion.div
                        className="w-full lg:w-[25%] h-auto max-h-[40vh] aspect-square bg-white border border-red-900/50 rounded overflow-hidden p-2 cursor-pointer hover:scale-105 transition-transform flex items-center justify-center mx-auto order-last lg:order-first"
                        onClick={() => setIsQrModalOpen(true)}
                      >
                        <QRCode
                          value={`${window.location.origin}/?code=${roomCode}`}
                          size={256}
                          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                          viewBox={`0 0 256 256`}
                        />
                      </motion.div>            <div className="grid gap-3 w-full flex-1 lg:pl-4">
              <div className="relative w-full bg-black/50 p-3 sm:p-4 rounded-2xl border border-red-500/30">
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-20">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyRoomCode}
                    className="text-red-400 hover:bg-red-500/20 rounded-full p-1 sm:p-2 pointer-events-auto"
                    aria-label={t("copyInvite")}
                  >
                    <motion.div key={copied ? "check" : "copy"} initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      {copied ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </motion.div>
                  </Button>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-mono font-bold text-red-500 tracking-widest break-words select-text">
                    {roomCode}
                  </div>
                </div>
              </div>
              <div className="relative w-full bg-black/50 p-3 sm:p-4 rounded-2xl border border-red-500/30">
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-20">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyLinkRoomCode}
                    className="text-red-400 hover:bg-red-500/20 rounded-full p-1 sm:p-2 pointer-events-auto"
                    aria-label={t("copyInvite")}
                  >
                    <motion.div key={copied1 ? "check" : "copy"} initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      {copied1 ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </motion.div>
                  </Button>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-red-400 font-mono mb-1 text-xs sm:text-sm md:text-base">{t("joinLink")}</div>
                  <div className="text-sm sm:text-base md:text-lg font-mono font-bold text-red-500 text-center break-words px-2">
                    {`${window.location.origin}/?code=${roomCode}`}
                  </div>
                </div>
              </div>
              <Card className="bg-black/20 border border-red-900/50">
                <CardContent className="p-4">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex justify-center"
                  >
                    <Button
                      onClick={startGame}
                      disabled={players.length === 0 || isStarting || countdown !== null}
                      className="relative overflow-hidden bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-mono text-sm sm:text-base md:text-lg lg:text-xl px-4 sm:px-6 md:px-8 lg:px-10 py-2 sm:py-3 md:py-4 lg:py-6 rounded-lg border-2 border-red-700 shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group w-full"
                    >
                      <span className="relative z-10 flex items-center justify-center">
                        {isStarting || countdown !== null ? (
                            <motion.div
                              animate={{ rotate: 360 }} 
                              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                              className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-2"
                            >
                              <Play className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                            </motion.div>
                          ) : (
                            <Play className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-2" />
                          )}
                        <span className="hidden sm:inline">{isStarting
                          ? t("startGame.starting")
                          : t("startGame.start")}</span>
                      </span>
                      <span className="absolute inset-0 bg-red-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                      <span className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>

        <QRModal
          open={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          roomCode={roomCode}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-7xl mx-auto"
        >
          <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-red-500 text-base sm:text-lg md:text-xl lg:text-2xl font-mono flex items-center gap-2 sm:gap-3">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                {t("players")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <AnimatePresence mode="popLayout">
                {players.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-8 sm:py-10"
                  >
                    <motion.div
                      animate={{
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    >
                      <p className="text-red-400 text-sm sm:text-base md:text-lg font-mono">{t("waitingHost")}</p>
                      <p className="text-red-400/80 text-xs sm:text-sm font-mono mt-2">{t("shareCode")}</p>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="players"
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2 sm:gap-3 md:gap-4 lg:gap-6"
                    transition={{ layout: { type: "spring", stiffness: 200, damping: 20 } }}
                  >
                    <AnimatePresence>
                      {players.map((player, index) => {
                        const selectedCharacter = characterOptions.find(
                          (char) => char.value === player.character_type
                        )
                        return (
                          <motion.div
                            key={player.player_id}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{
                              opacity: 0,
                              scale: 0.5,
                              x: Math.random() > 0.5 ? 100 : -100,
                              rotate: Math.random() * 180,
                              transition: { duration: 0.3, ease: "easeIn" },
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              damping: 20,
                              delay: index * 0.05,
                            }}
                            className="bg-black/40 border border-red-900/50 rounded-lg p-2 sm:p-3 md:p-4 text-center hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] relative group"
                          >
                            {!player.is_host && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => kickPlayer(player.player_id, player.nickname)}
                                className="absolute z-10 top-1 left-1 sm:top-2 sm:left-2 bg-black/60 text-red-500 hover:bg-red-700/60 p-1 sm:p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={t("kickPlayer", { nickname: player.nickname })}
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                              </Button>
                            )}
                            <motion.div
                              className="mb-1 sm:mb-2"
                              animate={{
                                rotate: [0, 5, -5, 0],
                              }}
                              transition={{
                                duration: 3,
                                repeat: Number.POSITIVE_INFINITY,
                                delay: index * 0.1,
                              }}
                            >
                              {selectedCharacter ? (
                                <div className="h-12 sm:h-16 md:h-20 lg:h-24 w-full flex items-center justify-center mt-1 sm:mt-2">
                                  <img
                                    src={selectedCharacter.gif}
                                    alt={selectedCharacter.alt}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="h-12 sm:h-16 md:h-20 lg:h-24 w-full flex items-center justify-center mb-1 sm:mb-2 text-red-400 text-xs sm:text-sm">
                                  {player.character_type}
                                </div>
                              )}
                            </motion.div>
                            <div className="text-red-500 font-medium text-xs sm:text-sm truncate mb-1 font-mono line-clamp-1">{player.nickname}</div>
                            {player.is_host && (
                              <Badge variant="secondary" className="text-xs bg-red-900 text-red-400 font-mono">
                                {t("host")}
                              </Badge>
                            )}
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
        <DialogContent className="bg-black/95 border border-red-600/70 text-red-400 rounded-xl shadow-[0_0_30px_rgba(255,0,0,0.4)] max-w-sm sm:max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-red-500">
              {t("kickPlayerConfirm", { nickname: selectedPlayer?.nickname })}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter className="mt-4 flex justify-end space-x-2">
            <Button
              variant="ghost"
              onClick={() => setKickDialogOpen(false)}
              className="text-gray-400 hover:text-red-400 hover:bg-red-950/40 px-3 py-2"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={confirmKickPlayer}
              className="bg-red-600 hover:bg-red-700 text-white shadow-[0_0_10px_rgba(255,0,0,0.6)] px-4 py-2"
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}