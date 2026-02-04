"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Play,
  Copy,
  Check,
  Clock,
  HelpCircle,
  Skull,
  Bone,
  Trash2,
  Maximize2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { mysupa } from "@/lib/supabase"; // SESUAI QUIZRUSH
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import QRCode from "react-qr-code";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { syncServerTime, calculateCountdown } from "@/lib/server-time";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useHostGuard } from "@/lib/host-guard";
import LoadingScreen from "@/components/LoadingScreen";

interface Session {
  id: string;
  game_pin: string;
  quiz_id: string;
  status: "waiting" | "active" | "finished";
  host_id: string;
  difficulty: string;
  question_limit: number;
  total_time_minutes: number;
  countdown_started_at?: string | null;
  current_questions?: any[];
  created_at: string;
}

interface Participant {
  id: string;
  session_id: string;
  nickname: string;
  character_type: string;
  is_host: boolean;
  score: number;
  correct_answers: number;
  is_alive: boolean;
  position_x: number;
  position_y: number;
  power_ups: number;
  health: any;
  joined_at: string;
}

function FullscreenQrOverlay({
  open,
  onClose,
  roomCode,
}: {
  open: boolean;
  onClose: () => void;
  roomCode: string;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"; // Cegah scroll
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!open) return null;

  const joinUrl = `${window.location.origin}/join/${roomCode}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose} // Tutup saat klik backdrop
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="
            relative
            w-full max-w-md md:max-w-lg lg:max-w-2xl
            aspect-square
            bg-white
            border-2 border-red-900/50 rounded-xl
            flex flex-col
            shadow-2xl
          "
          onClick={(e) => e.stopPropagation()} // Jangan tutup saat klik QR
        >
          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/30 rounded-full"
          >
            <X className="w-6 h-6 text-black" />
          </Button>

          {/* QR FULL AREA */}
          <div className="flex-1 w-full h-full p-4">
            <QRCode
              value={joinUrl}
              style={{ width: "100%", height: "100%" }}
              viewBox="0 0 256 256"
            />
          </div>

          {/* Room Code */}
          <div className="p-4 text-center shrink-0 border-t border-red-900/20">
            <p className="text-black text-xl md:text-2xl lg:text-3xl tracking-widest font-bold break-all">
              {roomCode}
            </p>
            <p className="text-gray-600 text-sm mt-2">Scan to Join</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function HostPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Participant[]>([]);
  const [copied, setCopied] = useState(false);
  const [copied1, setCopied1] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips] = useState(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      speed: 2 + Math.random() * 1.5,
      delay: Math.random() * 3,
    }))
  );
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Participant | null>(
    null
  );
  const [isFullscreenQrOpen, setIsFullscreenQrOpen] = useState(false);
  const [isAssetsLoaded, setIsAssetsLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastCursor, setLastCursor] = useState<string | null>(null);
  const playersContainerRef = useRef<HTMLDivElement>(null);

  // BGM State
  const [isMuted, setIsMuted] = useState(true); // Default muted if no setting

  useEffect(() => {
    const stored = localStorage.getItem("host_audio_enabled");
    if (stored !== null) {
      setIsMuted(stored !== "true"); // If enabled (true), then muted is false.
    }
  }, []);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Preload moved to countdown effect
  // useEffect(() => { ... }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.log("Audio play failed:", e));
      }
    }
  }, [isMuted]);

  const setSessionStatus = async (status: Session["status"]) => {
    if (!session?.id) return;
    const { error } = await mysupa
      .from("sessions")
      .update({
        status,
        started_at: new Date().toISOString(),
        countdown_started_at: null,
      })
      .eq("id", session.id);
    if (error) console.error("Set status error:", error);
  };

  const joinUrl = `${window.location.origin}/join/${roomCode}`;

  useHostGuard(roomCode);

  // ========================================
  // 1. FETCH SESSION + PARTICIPANTS (WITH PAGINATION)
  // ========================================
  const PAGE_LIMIT = 32;

  const fetchData = useCallback(async () => {
    if (!roomCode) return;

    try {
      const { data: sess, error: sessErr } = await mysupa
        .from("sessions")
        .select("*")
        .eq("game_pin", roomCode)
        .single();

      if (sessErr || !sess) {
        console.error("Session tidak ditemukan:", sessErr);
        router.push("/");
        return;
      }

      setSession(sess);

      const { data: parts, error: partsErr } = await mysupa
        .from("participants")
        .select("*")
        .eq("session_id", sess.id)
        .order("joined_at", { ascending: true })
        .limit(PAGE_LIMIT);

      if (partsErr) console.error("Error fetch participants:", partsErr);
      else {
        setPlayers(parts || []);
        setHasMore((parts?.length || 0) === PAGE_LIMIT);
        if (parts && parts.length > 0) {
          setLastCursor(parts[parts.length - 1].joined_at);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error(err);
      router.push("/");
    }
  }, [roomCode, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ========================================
  // LOAD MORE PARTICIPANTS
  // ========================================
  const loadMore = useCallback(async () => {
    if (!session?.id || !hasMore || isLoadingMore || !lastCursor) return;

    setIsLoadingMore(true);

    try {
      const { data: moreParts, error: moreErr } = await mysupa
        .from("participants")
        .select("*")
        .eq("session_id", session.id)
        .gt("joined_at", lastCursor)
        .order("joined_at", { ascending: true })
        .limit(PAGE_LIMIT);

      if (moreErr) {
        console.error("Error loading more participants:", moreErr);
        toast.error("Gagal memuat lebih banyak pemain");
      } else if (moreParts && moreParts.length > 0) {
        setPlayers((prev) => [...prev, ...moreParts]);
        setLastCursor(moreParts[moreParts.length - 1].joined_at);
        setHasMore(moreParts.length === PAGE_LIMIT);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [session?.id, hasMore, isLoadingMore, lastCursor]);

  // ========================================
  // HANDLE SCROLL FOR LOAD MORE
  // ========================================
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 20) {
      loadMore();
    }
  }, [loadMore]);

  // ========================================
  // 3. REALTIME – 2 CHANNELS
  // ========================================
  useEffect(() => {
    if (!session?.id) return;

    const sessionChannel = mysupa
      .channel(`session:${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const newSess = payload.new as Session;
          setSession(newSess);

          // REDIRECT IMMEDIATELY if countdown starts OR status is active
          if (newSess.countdown_started_at || newSess.status === "active") {
            router.replace(`/host/${roomCode}/game`);
          }
        }
      )
      .subscribe();

    const participantsChannel = mysupa
      .channel(`participants:${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${session.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") setPlayers((p) => [...p, payload.new as Participant]);
          if (payload.eventType === "UPDATE") setPlayers((p) => p.map((x) => x.id === payload.new.id ? (payload.new as Participant) : x));
          if (payload.eventType === "DELETE") setPlayers((p) => p.filter((x) => x.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      mysupa.removeChannel(sessionChannel);
      mysupa.removeChannel(participantsChannel);
    };
  }, [session?.id, roomCode, router]);

  // ========================================
  // 4. KICK PLAYER
  // ========================================
  const kickPlayer = (player: Participant) => {
    setSelectedPlayer(player);
    setKickDialogOpen(true);
  };

  const confirmKickPlayer = async () => {
    if (!selectedPlayer || !session) return;
    const { error } = await mysupa
      .from("participants")
      .delete()
      .eq("id", selectedPlayer.id)
      .eq("session_id", session.id);
    if (error) toast.error(t("kickPlayerError") || "Gagal mengeluarkan pemain");
    else
      toast.success(t("kickPlayerSuccess", { nickname: selectedPlayer.nickname }) || `${selectedPlayer.nickname} dikeluarkan!`);
    setKickDialogOpen(false);
    setSelectedPlayer(null);
  };

  // ========================================
  // 5. START GAME
  // ========================================
  const startGame = async () => {
    if (!session || players.length === 0)
      return toast.error("Tidak ada pemain!");

    setIsStarting(true);
    await syncServerTime();

    // Just trigger countdown, redirection happens via Realtime
    const { error } = await mysupa
      .from("sessions")
      .update({ countdown_started_at: new Date().toISOString() })
      .eq("id", session.id);

    if (error) {
      toast.error("Gagal memulai countdown");
      setIsStarting(false);
    }
  };

  // ========================================
  // COPY & FLICKER
  // ========================================
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const copyLinkRoomCode = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied1(true);
    setTimeout(() => setCopied1(false), 2000);
  };

  useEffect(() => {
    const iv = setInterval(
      () => setFlickerText((p) => !p),
      100 + Math.random() * 150
    );
    return () => clearInterval(iv);
  }, []);

  const characterOptions = [
    {
      value: "robot1",
      name: "Hijau",
      gif: "/character/player/character.webp",
      alt: "Karakter Hijau",
    },
    {
      value: "robot2",
      name: "Biru",
      gif: "/character/player/character1-crop.webp",
      alt: "Karakter Biru",
    },
    {
      value: "robot3",
      name: "Merah",
      gif: "/character/player/character2-crop.webp",
      alt: "Karakter Merah",
    },
    {
      value: "robot4",
      name: "Ungu",
      gif: "/character/player/character3-crop.webp",
      alt: "Karakter Ungu",
    },
    {
      value: "robot5",
      name: "Oranye",
      gif: "/character/player/character4-crop.webp",
      alt: "Karakter Oranye",
    },
    {
      value: "robot6",
      name: "Kuning",
      gif: "/character/player/character5-resize.webp",
      alt: "Karakter Kuning",
    },
    {
      value: "robot7",
      name: "Abu-abu",
      gif: "/character/player/character6.webp",
      alt: "Karakter Abu-abu",
    },
    {
      value: "robot8",
      name: "Pink",
      gif: "/character/player/character7-crop.webp",
      alt: "Karakter Pink",
    },
    {
      value: "robot9",
      name: "Cokelat",
      gif: "/character/player/character8-crop.webp",
      alt: "Karakter Cokelat",
    },
    {
      value: "robot10",
      name: "Emas",
      gif: "/character/player/character9-crop.webp",
      alt: "Karakter Emas",
    },
  ];

  // Preload assets when countdown starts
  useEffect(() => {
    if (!session?.countdown_started_at) return;

    const assetsToPreload = [
      '/map6/1.webp',
      '/map6/3.webp',
      '/map6/4.webp',
      '/map6/5.webp',
      '/map6/7.webp',
      '/map6/8.webp',
      '/character/chaser/darknight.webp',
      '/character/chaser/monster1.webp',
      '/character/chaser/monster2.webp',
      '/character/chaser/monster3.webp',
      '/character/chaser/zombie.webp',
      '/character/player/character1-crop.webp',
      '/character/player/character2-crop.webp',
      '/character/player/character3-crop.webp',
      '/character/player/character4-crop.webp',
      '/character/player/character5-resize.webp',
      '/character/player/character6.webp',
      '/character/player/character8-crop.webp',
      '/character/player/character9-crop.webp',
    ];

    assetsToPreload.forEach(src => {
      const img = new window.Image();
      img.src = src;
    });
  }, [session?.countdown_started_at]);

  const isPageReady = !isLoading && !!session;

  return (
    <LoadingScreen isReady={isPageReady}>
      {session && (
        <div className="min-h-screen bg-black relative overflow-hidden select-none">
          <div className="absolute top-4 left-4 z-20 hidden md:block">
            <Image
              src="/logo/quizrush.png"
              alt="QuizRush Logo"
              width={140}
              height={35}
              className="w-32 md:w-40 lg:w-48 h-auto"
              unoptimized
            />
          </div>
          <div className="absolute top-4 right-4 z-20 hidden md:block">
            <img
              src="/logo/gameforsmartlogo-horror.png"
              alt="Game for Smart Logo"
              className="w-40 md:w-48 lg:w-56 h-auto"
            />
          </div>
          <audio
            ref={audioRef}
            src="/musics/lobby.mp3"
            loop
            autoPlay
            muted={isMuted} // State kontrol
          />

          {/* Mute/Unmute Toggle Button */}
          <div className="fixed bottom-4 right-4 z-50">
            <Button
              variant="default"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              className="bg-red-600 hover:bg-red-700 text-white border-2 border-white/20 rounded-full w-12 h-12 shadow-[0_0_20px_rgba(220,38,38,0.6)] hover:shadow-[0_0_30px_rgba(220,38,38,0.8)] hover:scale-110 transition-all duration-300"
            >
              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </Button>
          </div>

          <div
            className="fixed inset-0 z-0"
            style={{
              backgroundImage: "url('/background/21.gif')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          ></div>
          <div className="fixed inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5">
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
              transition={{
                duration: drip.speed,
                delay: drip.delay,
                ease: "linear",
                repeat: Infinity,
              }}
              className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
              style={{
                left: `${drip.left}%`,
                opacity: 0.6 + Math.random() * 0.2,
              }}
            />
          ))}

          <div className="fixed inset-0 pointer-events-none">
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

          <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJzY3JhdGNoZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48cGF0aCBkPSJNMCAwLDUwMCA1MDAiIHN0cm9rZT0icmdiYSgyNTUsMCwwLDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48cGF0aCBkPSJNMCAxMDBLNTAwIDYwMCIgc3Ryb2tlPSJyZ2JhKDI1NSwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDIwMEw1MDAgNzAwIiBzdHJva2U9InJnYmEoMjU1LDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NjcmF0Y2hlcykiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] opacity-20" />

          <div className="fixed top-0 left-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-20">
            <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
          </div>
          <div className="fixed top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-20">
            <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
          </div>
          <div className="fixed bottom-0 left-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-20">
            <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
          </div>
          <div className="fixed bottom-0 right-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 opacity-20">
            <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/70 to-transparent" />
          </div>



          <div className="relative z-10 mx-auto p-4 sm:p-6 lg:p-7">
            <motion.header
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                delay: 0.3,
                type: "spring",
                stiffness: 120,
              }}
              className="flex flex-col gap-2 sm:gap-4 mb-6 sm:mb-10 max-w-7xl mx-auto"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.5,
                  type: "spring",
                  stiffness: 100,
                }}
                className="flex justify-center items-center text-center mt-10"
              >
                <h1
                  className={`text-4xl md:text-5xl lg:text-6xl tracking-wider transition-all duration-150 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse ${flickerText ? "opacity-100" : "opacity-50"
                    }`}
                  style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
                >
                  {t("hostRoomTitle")}
                </h1>
              </motion.div>
            </motion.header>

            {/* Main Two-Column Layout */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 items-start">
              {/* LEFT COLUMN - QR Code, Room Code, Link, Start Button */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2 bg-black/40 border border-red-900/50 rounded-lg p-4 lg:p-6 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] flex flex-col gap-3"
              >
                {/* Room Code */}
                <div className="relative w-full bg-black/50 p-2 rounded-xl border border-red-500/30">
                  <div className="absolute top-1 right-1 z-20">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyRoomCode}
                      className="text-red-400 hover:bg-red-500/20 rounded-full p-2"
                    >
                      <motion.div
                        key={copied ? "check" : "copy"}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        {copied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </motion.div>
                    </Button>
                  </div>
                  <div className="text-3xl sm:text-4xl lg:text-5xl text-red-500 tracking-widest text-center font-bold">
                    {roomCode}
                  </div>
                </div>



                {/* QR Code */}
                <motion.div
                  className="w-full aspect-square max-w-[300px] mx-auto bg-white border-2 border-red-900/50 rounded-lg overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform flex items-center justify-center"
                  onClick={() => window.innerWidth >= 768 && setIsFullscreenQrOpen(true)}
                >
                  <QRCode
                    value={joinUrl}
                    style={{ width: "100%", height: "100%", padding: "12px" }}
                    viewBox="0 0 256 256"
                  />
                </motion.div>

                {/* Join Link - Below Room Code */}
                <div className="relative w-full bg-black/50 p-2 rounded-xl border border-red-500/30">
                  <div className="absolute top-1 right-1 z-20">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyLinkRoomCode}
                      className="text-red-400 hover:bg-red-500/20 rounded-full p-2"
                    >
                      <motion.div
                        key={copied1 ? "check" : "copy"}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        {copied1 ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </motion.div>
                    </Button>
                  </div>
                  <div className="text-base text-red-500 text-center break-all">
                    {joinUrl}
                  </div>
                </div>

                {/* Start Button */}
                <Button
                  onClick={startGame}
                  disabled={players.length === 0 || isStarting || countdown !== null}
                  className="relative overflow-hidden bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white text-lg lg:text-xl py-4 lg:py-5 rounded-lg border-2 border-red-700 shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group w-full"
                >
                  <span className="relative z-10 flex items-center justify-center">
                    {isStarting || countdown !== null ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 mr-2"
                      >
                        <Play className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <Play className="w-5 h-5 mr-2" />
                    )}
                    <span>{isStarting ? t("startGame.starting") : t("startGame.start")}</span>
                  </span>
                  <span className="absolute inset-0 bg-red-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
                </Button>
              </motion.div>

              {/* RIGHT COLUMN - Player List */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-3"
              >
                <Card className="bg-black/40 border border-red-900/50 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] gap-0">
                  <CardHeader>
                    <CardTitle className="text-red-500 text-xl lg:text-2xl flex items-center gap-2">
                      <Users className="w-5 h-5 lg:w-6 lg:h-6" />
                      <motion.span
                        key={players.length}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                      >
                        {players.length}
                      </motion.span>
                      <span>{t("players")}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <AnimatePresence mode="popLayout">
                      {players.length === 0 ? (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-center py-12 lg:py-20"
                        >
                          <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Users className="w-12 h-12 mx-auto mb-4 text-red-500/50" />
                            <p className="text-red-400 text-base lg:text-lg">
                              {t("waitingHost")}
                            </p>
                          </motion.div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="players"
                          className="overflow-y-auto max-h-[445px] pr-2"
                          ref={playersContainerRef}
                          onScroll={handleScroll}
                        >
                          <motion.div
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4"
                            transition={{ layout: { type: "spring", stiffness: 200, damping: 20 } }}
                          >
                            <AnimatePresence>
                              {players.map((player, index) => {
                                const selectedCharacter = characterOptions.find(
                                  (c) => c.value === player.character_type
                                );
                                return (
                                  <motion.div
                                    key={player.id}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{
                                      opacity: 0,
                                      scale: 0.5,
                                      x: Math.random() > 0.5 ? 100 : -100,
                                      rotate: Math.random() * 180,
                                      transition: { duration: 0.3, ease: "easeIn" },
                                    }}
                                    className="bg-black/40 border border-red-900/50 rounded-lg p-3 text-center hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] relative group"
                                  >
                                    {!player.is_host && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => kickPlayer(player)}
                                        className="absolute z-10 top-1 left-1 bg-black/60 text-red-500 hover:bg-red-700/60 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <motion.div
                                      className="mb-1"
                                      animate={{ rotate: [0, 5, -5, 0] }}
                                      transition={{ duration: 3, repeat: Infinity, delay: index * 0.1 }}
                                    >
                                      {selectedCharacter ? (
                                        <div className="h-16 lg:h-20 w-full flex items-center justify-center">
                                          <img
                                            src={selectedCharacter.gif}
                                            alt={selectedCharacter.alt}
                                            className="max-h-full max-w-full object-contain"
                                          />
                                        </div>
                                      ) : (
                                        <div className="h-16 lg:h-20 w-full flex items-center justify-center text-red-400 text-sm">
                                          {player.character_type}
                                        </div>
                                      )}
                                    </motion.div>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="text-red-500 font-medium text-xs sm:text-sm line-clamp-1 cursor-pointer">
                                            {player.nickname}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-black/95 text-red-300 border-2 border-red-600 shadow-2xl">
                                          <p>{player.nickname}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    {player.is_host && (
                                      <Badge variant="secondary" className="text-xs bg-red-900 text-red-400 mt-1">
                                        {t("host")}
                                      </Badge>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </motion.div>
                          {isLoadingMore && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center gap-2 text-red-500 justify-center py-3"
                            >
                              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                              <p className="text-sm">{t("loadingMore") || "Loading more..."}</p>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>

          <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
            <DialogContent className="bg-black/95 border border-red-600/70 text-red-400 rounded-xl shadow-[0_0_30px_rgba(255,0,0,0.4)] max-w-sm sm:max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg  text-red-500">
                  {t("kickPlayerConfirm", {
                    nickname: selectedPlayer?.nickname,
                  })}
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
              0%,
              100% {
                transform: translateY(0px) rotate(0deg);
              }
              50% F {
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

          {/* Overlay QR dengan AnimatePresence */}
          <AnimatePresence>
            {isFullscreenQrOpen && (
              <FullscreenQrOverlay
                open={isFullscreenQrOpen}
                onClose={() => setIsFullscreenQrOpen(false)}
                roomCode={roomCode}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </LoadingScreen>
  );
}
