"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Play, Copy, Check, Clock, List, Skull, Bone, Trash2, Maximize2, X } from "lucide-react"
import { mysupa } from "@/lib/supabase"  // SESUAI QUIZRUSH
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import QRCode from "react-qr-code"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { syncServerTime, calculateCountdown } from "@/lib/server-time"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"
import { useHostGuard } from "@/lib/host-guard"
import LoadingScreen from "@/components/LoadingScreen"

interface Session {
  id: string
  game_pin: string
  quiz_id: string
  status: "waiting" | "playing" | "finished"
  host_id: string
  difficulty: string
  question_limit: number
  total_time_minutes: number
  countdown_started_at?: string | null
  current_questions?: any[]
  created_at: string
}

interface Participant {
  id: string
  session_id: string
  nickname: string
  character_type: string
  is_host: boolean
  score: number
  correct_answers: number
  is_alive: boolean
  position_x: number
  position_y: number
  power_ups: number
  health: any
  joined_at: string
}

function FullscreenQrOverlay({ open, onClose, roomCode }: { open: boolean; onClose: () => void; roomCode: string }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "unset" }
  }, [open])

  if (!open) return null

  const joinUrl = `${window.location.origin}/?code=${roomCode}`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.8 }}
        className="relative bg-white p-12 rounded-3xl shadow-2xl max-w-[90vw] max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <Button onClick={onClose} variant="ghost" size="icon" className="absolute -top-16 -right-16 text-white hover:bg-white/20 rounded-full">
          <X className="w-12 h-12" />
        </Button>
        <QRCode value={joinUrl} size={524} level="H" className="mx-auto" />
        <div className="mt-10 text-center">
          <p className="text-black text-5xl font-bold tracking-widest">{roomCode}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function HostPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const roomCode = params.roomCode as string

  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Participant[]>([])
  const [copied, setCopied] = useState(false)
  const [copied1, setCopied1] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flickerText, setFlickerText] = useState(true)
  const [bloodDrips] = useState(() => Array.from({ length: 10 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    speed: 2 + Math.random() * 1.5,
    delay: Math.random() * 3,
  })))
  const [kickDialogOpen, setKickDialogOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Participant | null>(null)
  const [isFullscreenQrOpen, setIsFullscreenQrOpen] = useState(false)

  useHostGuard(roomCode)

  // ========================================
  // 1. FETCH SESSION + PARTICIPANTS
  // ========================================
  const fetchData = useCallback(async () => {
    if (!roomCode) return

    try {
      const { data: sess, error: sessErr } = await mysupa
        .from("sessions")
        .select("*")
        .eq("game_pin", roomCode)
        .single()

      if (sessErr || !sess) {
        console.error("Session tidak ditemukan:", sessErr)
        router.push("/")
        return
      }

      setSession(sess)

      const { data: parts, error: partsErr } = await mysupa
        .from("participants")
        .select("*")
        .eq("session_id", sess.id)
        .order("joined_at", { ascending: true })

      if (partsErr) console.error("Error fetch participants:", partsErr)
      else setPlayers(parts || [])

      setIsLoading(false)
    } catch (err) {
      console.error(err)
      router.push("/")
    }
  }, [roomCode, router])

  useEffect(() => { fetchData() }, [fetchData])

  // ========================================
  // 2. REALTIME – 2 CHANNELS
  // ========================================
  useEffect(() => {
    if (!session?.id) return

    const sessionChannel = mysupa.channel(`session:${session.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${session.id}`
      }, (payload) => {
        const newSess = payload.new as Session
        setSession(newSess)
        if (newSess.status === "playing") {
          router.replace(`/host/${roomCode}/game`)
        }
      })
      .subscribe()

    const participantsChannel = mysupa.channel(`participants:${session.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "participants",
        filter: `session_id=eq.${session.id}`
      }, (payload) => {
        if (payload.eventType === "INSERT") setPlayers(p => [...p, payload.new as Participant])
        if (payload.eventType === "UPDATE") setPlayers(p => p.map(x => x.id === payload.new.id ? payload.new as Participant : x))
        if (payload.eventType === "DELETE") setPlayers(p => p.filter(x => x.id !== payload.old.id))
      })
      .subscribe()

    return () => { mysupa.removeAllChannels() }
  }, [session?.id, roomCode, router])

  // ========================================
  // 3. COUNTDOWN
  // ========================================
  useEffect(() => {
    if (!session?.countdown_started_at) {
      setCountdown(null)
      setIsStarting(false)
      return
    }

    const update = () => {
      const remaining = calculateCountdown(session.countdown_started_at!, 10000)
      setCountdown(remaining)
      if (remaining <= 0) {
        setCountdown(null)
        setIsStarting(false)
      }
    }

    update()
    const iv = setInterval(update, 100)
    return () => clearInterval(iv)
  }, [session?.countdown_started_at])

  // ========================================
  // 4. KICK PLAYER
  // ========================================
  const kickPlayer = (player: Participant) => {
    setSelectedPlayer(player)
    setKickDialogOpen(true)
  }

  const confirmKickPlayer = async () => {
    if (!selectedPlayer || !session) return
    const { error } = await mysupa.from("participants").delete().eq("id", selectedPlayer.id).eq("session_id", session.id)
    if (error) toast.error(t("kickPlayerError") || "Gagal mengeluarkan pemain")
    else toast.success(t("kickPlayerSuccess", { nickname: selectedPlayer.nickname }) || `${selectedPlayer.nickname} dikeluarkan!`)
    setKickDialogOpen(false)
    setSelectedPlayer(null)
  }

  // ========================================
  // 5. START GAME
  // ========================================
  const startGame = async () => {
    if (!session || players.length === 0) return toast.error("Tidak ada pemain!")
    setIsStarting(true)
    await syncServerTime()
    const { error } = await mysupa.from("sessions").update({ countdown_started_at: new Date().toISOString() }).eq("id", session.id)
    if (error) { toast.error("Gagal memulai countdown"); setIsStarting(false) }
  }

  // ========================================
  // COPY & FLICKER
  // ========================================
  const copyRoomCode = () => { navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const copyLinkRoomCode = () => { navigator.clipboard.writeText(`${window.location.origin}/${roomCode}`); setCopied1(true); setTimeout(() => setCopied1(false), 2000) }

  useEffect(() => {
    const iv = setInterval(() => setFlickerText(p => !p), 100 + Math.random() * 150)
    return () => clearInterval(iv)
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

  if (isLoading || !session) return <LoadingScreen children={undefined} isReady={false} />

  return (
    <LoadingScreen isReady={true}>
      {session && (
        <div className="min-h-screen bg-black relative overflow-hidden select-none">
          <div className="absolute top-4 left-4 z-20 hidden md:block">
            <Image src="/logo/quizrushlogo.png" alt="QuizRush Logo" width={140} height={35} className="w-32 md:w-40 lg:w-48 h-auto" unoptimized />
          </div>
          <div className="absolute top-4 right-4 z-20 hidden md:block">
            <img src="/logo/gameforsmartlogo-horror.png" alt="Game for Smart Logo" className="w-40 md:w-48 lg:w-56 h-auto" />
          </div>
          <audio src="/musics/background-music-room.mp3" autoPlay loop muted />
          <div className="absolute inset-0 z-0" style={{ backgroundImage: "url('/background/21.gif')", backgroundSize: "cover", backgroundPosition: "center" }}></div>
          <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5">
            <div className="absolute inset-0 opacity-20">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="absolute w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-red-900 rounded-full mix-blend-multiply blur-xl"
                  style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0.3 + Math.random() * 0.4 }} />
              ))}
            </div>
          </div>

          {bloodDrips.map((drip) => (
            <motion.div key={drip.id} initial={{ y: -100 }} animate={{ y: "100vh" }} transition={{ duration: drip.speed, delay: drip.delay, ease: "linear", repeat: Infinity }}
              className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
              style={{ left: `${drip.left}%`, opacity: 0.6 + Math.random() * 0.2 }} />
          ))}

          <div className="absolute inset-0 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute text-red-900/20 animate-float hidden sm:block"
                style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, fontSize: `${2 + Math.random() * 3}rem`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${15 + Math.random() * 20}s` }}>
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  className="text-[8rem] sm:text-[12rem] md:text-[16rem] lg:text-[20rem] xl:text-[30rem] font-mono font-bold text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] flex-shrink-0">
                  {countdown}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`relative z-10 mx-auto p-4 sm:p-6 lg:p-7 ${countdown !== null ? "hidden" : ""}`}>
            <motion.header initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
              className="flex flex-col gap-2 sm:gap-4 mb-6 sm:mb-10 max-w-7xl mx-auto">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
                className="flex justify-center items-center text-center mt-10">
                <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold font-mono tracking-wider transition-all duration-150 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse ${flickerText ? 'opacity-100' : 'opacity-50'}`}
                  style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}>
                  {t("hostRoomTitle")}
                </h1>
              </motion.div>
            </motion.header>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6 lg:mb-8">
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="grid grid-cols-3 lg:grid-cols-1 gap-2 sm:gap-3 lg:gap-4 lg:col-span-1">
                <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                  <CardContent>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-red-500 flex-shrink-0" />
                      <motion.div key={players.length} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
                        className="text-lg sm:text-xl md:text-2xl lg:text-3xl lg:text-4xl font-bold text-red-500 font-mono">
                        {players.length}
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                  <CardContent>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-red-500 flex-shrink-0" />
                      <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl lg:text-4xl font-bold text-red-500 font-mono">
                        {session.total_time_minutes}:00
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                  <CardContent>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <List className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 text-red-500 flex-shrink-0" />
                      <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl lg:text-4xl font-bold text-red-500 font-mono">
                        {session.question_limit}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }}
                className="relative flex flex-col lg:flex-row items-stretch lg:items-center bg-black/40 border border-red-900/50 rounded-lg p-4 lg:p-6 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] lg:col-span-4 gap-4 lg:gap-6">
                <motion.div
                  className="w-full lg:w-[25%] h-auto max-h-[40vh] aspect-square bg-white border border-red-900/50 rounded overflow-hidden p-2 cursor-pointer hover:scale-105 transition-transform flex items-center justify-center mx-auto order-last lg:order-first md:cursor-pointer lg:cursor-pointer max-md:pointer-events-none"
                  onClick={() => window.innerWidth >= 768 && setIsFullscreenQrOpen(true)}>
                  <QRCode value={`${window.location.origin}/?code=${roomCode}`} size={256} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox="0 0 256 256 luminosity" />
                </motion.div>

                <div className="grid gap-3 w-full flex-1 lg:pl-4">
                  <div className="relative w-full bg-black/50 p-3 sm:p-4 rounded-2xl border border-red-500/30">
                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-20">
                      <Button variant="ghost" size="sm" onClick={copyRoomCode} className="text-red-400 hover:bg-red-500/20 rounded-full p-1 sm:p-2 pointer-events-auto">
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
                      <Button variant="ghost" size="sm" onClick={copyLinkRoomCode} className="text-red-400 hover:bg-red-500/20 rounded-full p-1 sm:p-2 pointer-events-auto">
                        <motion.div key={copied1 ? "check" : "copy"} initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          {copied1 ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </motion.div>
                      </Button>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="text-red-400 font-mono mb-1 text-xs sm:text-sm md:text-base">{t("joinLink")}</div>
                      <div className="text-sm sm:text-base md:text-lg font-mono font-bold text-red-500 text-center break-words px-2">
                        {`${window.location.origin}/${roomCode}`}
                      </div>
                    </div>
                  </div>

                  <Card className="bg-black/20 border border-red-900/50">
                    <CardContent className="px-4">
                      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="flex justify-center">
                        <Button onClick={startGame} disabled={players.length === 0 || isStarting || countdown !== null}
                          className="relative overflow-hidden bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-mono text-sm sm:text-base md:text-lg lg:text-xl px-4 sm:px-6 md:px-8 lg:px-10 py-2 sm:py-3 md:py-4 lg:py-6 rounded-lg border-2 border-red-700 shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group w-full">
                          <span className="relative z-10 flex items-center justify-center">
                            {isStarting || countdown !== null ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }} className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-2">
                                <Play className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                              </motion.div>
                            ) : <Play className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-2" />}
                            <span>{isStarting ? t("startGame.starting") : t("startGame.start")}</span>
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

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="max-w-7xl mx-auto">
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
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8 sm:py-10">
                        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}>
                          <p className="text-red-400 text-sm sm:text-base md:text-lg font-mono">{t("waitingHost")}</p>
                          <p className="text-red-400/80 text-xs sm:text-sm font-mono mt-2">{t("shareCode")}</p>
                        </motion.div>
                      </motion.div>
                    ) : (
                      <motion.div key="players" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2 sm:gap-3 md:gap-4 lg:gap-6"
                        transition={{ layout: { type: "spring", stiffness: 200, damping: 20 } }}>
                        <AnimatePresence>
                          {players.map((player, index) => {
                            const selectedCharacter = characterOptions.find(c => c.value === player.character_type)
                            return (
                              <motion.div key={player.id} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, scale: 0.5, x: Math.random() > 0.5 ? 100 : -100, rotate: Math.random() * 180, transition: { duration: 0.3, ease: "easeIn" } }}
                                transition={{ type: "spring", stiffness: 200, damping: 20, delay: index * 0.05 }}
                                className="bg-black/40 border border-red-900/50 rounded-lg p-2 sm:p-3 md:p-4 text-center hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] relative group">
                                {!player.is_host && (
                                  <Button variant="ghost" size="sm" onClick={() => kickPlayer(player)}
                                    className="absolute z-10 top-1 left-1 sm:top-2 sm:left-2 bg-black/60 text-red-500 hover:bg-red-700/60 p-1 sm:p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </Button>
                                )}
                                <motion.div className="mb-1 sm:mb-2" animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, delay: index * 0.1 }}>
                                  {selectedCharacter ? (
                                    <div className="h-12 sm:h-16 md:h-20 lg:h-24 w-full flex items-center justify-center mt-1 sm:mt-2">
                                      <img src={selectedCharacter.gif} alt={selectedCharacter.alt} className="max-h-full max-w-full object-contain" />
                                    </div>
                                  ) : (
                                    <div className="h-12 sm:h-16 md:h-20 lg:h-24 w-full flex items-center justify-center mb-1 sm:mb-2 text-red-400 text-xs sm:text-sm">
                                      {player.character_type}
                                    </div>
                                  )}
                                </motion.div>
                                <div className="text-red-500 font-medium text-xs sm:text-sm truncate mb-1 font-mono line-clamp-1">{player.nickname}</div>
                                {player.is_host && <Badge variant="secondary" className="text-xs bg-red-900 text-red-400 font-mono">{t("host")}</Badge>}
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
                <Button variant="ghost" onClick={() => setKickDialogOpen(false)} className="text-gray-400 hover:text-red-400 hover:bg-red-950/40 px-3 py-2">
                  {t("cancel")}
                </Button>
                <Button onClick={confirmKickPlayer} className="bg-red-600 hover:bg-red-700 text-white shadow-[0_0_10px_rgba(255,0,0,0.6)] px-4 py-2">
                  {t("confirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <style jsx global>{`
            @keyframes fall { to { transform: translateY(100vh); } }
            @keyframes float { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% F{ transform: translateY(-20px) rotate(180deg); } }
            .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
          `}</style>

          <FullscreenQrOverlay open={isFullscreenQrOpen} onClose={() => setIsFullscreenQrOpen(false)} roomCode={roomCode} />
        </div>
      )}
    </LoadingScreen>
  )
}