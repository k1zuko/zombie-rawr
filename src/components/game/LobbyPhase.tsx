// Halaman Lobby Phase (LobbyPhase.js or similar)
"use client";

// Mengimpor dependensi yang diperlukan
import { useState, useEffect } from "react";
import { Users, Skull, Zap, Play, Ghost, Bone, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import SoulStatus from "./SoulStatus";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { syncServerTime, calculateCountdown } from "@/lib/server-time"

import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

// Mendefinisikan tipe data untuk Player
interface Player {
  id: string
  nickname: string
  isHost?: boolean
  isReady?: boolean
  health?: number
  maxHealth?: number
  score?: number
  room_id?: string
  character_type?: string
}

// Mendefinisikan tipe data untuk props LobbyPhase
interface LobbyPhaseProps {
  currentPlayer: Player
  players: Player[]
  gameLogic: any
  isSoloMode: boolean
  wrongAnswers?: number
}

// Opsi karakter yang tersedia
const characterOptions = [
  { value: "robot1", name: "Hijau", gif: "/character/character.gif", alt: "Karakter Hijau" },
  { value: "robot2", name: "Biru", gif: "/character/character1.gif", alt: "Karakter Biru" },
  { value: "robot3", name: "Merah", gif: "/character/character2.gif", alt: "Karakter Merah" },
  { value: "robot4", name: "Ungu", gif: "/character/character3.gif", alt: "Karakter Ungu" },
  { value: "robot5", name: "Oranye", gif: "/character/character4.gif", alt: "Karakter Oranye" },
  { value: "robot6", name: "Kuning", gif: "/character/character5.gif", alt: "Karakter Kuning" },
  { value: "robot7", name: "Abu-abu", gif: "/character/character6.gif", alt: "Karakter Abu-abu" },
  { value: "robot8", name: "Pink", gif: "/character/character7.gif", alt: "Karakter Pink" },
  { value: "robot9", name: "Cokelat", gif: "/character/character8.gif", alt: "Karakter Cokelat" },
  { value: "robot10", name: "Emas", gif: "/character/character9.gif", alt: "Karakter Emas" },
]

export default function LobbyPhase({
  currentPlayer,
  players,
  gameLogic,
  isSoloMode,
  wrongAnswers = 0,
}: LobbyPhaseProps) {
  // State untuk mengelola efek UI dan data permainan
  const { t } = useTranslation()
  const [flickerText, setFlickerText] = useState(true)
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([])
  const [atmosphereText, setAtmosphereText] = useState(() => {
  const texts = t("atmosphereTexts", { returnObjects: true }) as string[];
  return texts[0];
});
  const [countdown, setCountdown] = useState<number | null>(null)
  const [room, setRoom] = useState<any>(null)
  const [isCharacterDialogOpen, setIsCharacterDialogOpen] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState(currentPlayer.character_type || "robot1")
  const router = useRouter()

  // Teks atmosfer untuk menciptakan suasana
  const atmosphereTexts = t("atmosphereTexts", { returnObjects: true }) as string[];

  useEffect(() => {
    syncServerTime()
  }, [])

  useEffect(() => {
    const fetchRoom = async () => {
      if (!currentPlayer.room_id) {
        console.warn("⚠️ LobbyPhase: Tidak ada room_id untuk currentPlayer")
        return
      }

      try {
        console.log("🏠 LobbyPhase: Mengambil data ruangan untuk room_id:", currentPlayer.room_id)
        const { data, error } = await supabase
          .from("game_rooms")
          .select("*") // pastikan ambil semua kolom, termasuk countdown_start
          .eq("id", currentPlayer.room_id)
          .single()

        if (error) {
          console.error("❌ LobbyPhase: Gagal mengambil ruangan:", error)
          return
        }

        console.log("✅ LobbyPhase: Data ruangan berhasil diambil:", data)
        setRoom(data)
      } catch (error) {
        console.error("❌ LobbyPhase: Gagal mengambil ruangan:", error)
      }
    }

    fetchRoom()
  }, [currentPlayer.room_id])

  useEffect(() => {
    if (!room?.countdown_start) {
      setCountdown(null)
      return
    }

    const updateCountdown = () => {
      const remaining = calculateCountdown(room.countdown_start, 10000)
      console.log("⏰ LobbyPhase: Server-synced countdown:", remaining)
      setCountdown(remaining)

      if (remaining <= 0) {
        setCountdown(null)
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
    }
  }, [room?.countdown_start])

  // Langganan real-time untuk pembaruan ruangan
  useEffect(() => {
  if (!currentPlayer.room_id) return;

  const channel = supabase
    .channel(`lobby_${currentPlayer.room_id}`)
    // listener UPDATE ruangan (sudah ada)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${currentPlayer.room_id}` },
      (payload) => {
        setRoom(payload.new);
      }
    )
    // listener DELETE untuk diri sendiri (baru)
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "players", filter: `id=eq.${currentPlayer.id}` },
      () => {
        router.replace("/?kicked=1");
      }
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("Lobby subscribed");
      } else if (status === "CHANNEL_ERROR") {
        console.error("Lobby channel error:", err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [currentPlayer.room_id, currentPlayer.id, router]);

  // Langganan real-time untuk mendeteksi kick pada pemain
  useEffect(() => {
    if (!currentPlayer.room_id) {
      console.warn("⚠️ LobbyPhase: Tidak ada room_id untuk langganan pemain real-time");
      return;
    }

    console.log("🔗 LobbyPhase: Menyiapkan langganan real-time untuk pemain di room_id:", currentPlayer.room_id);

    const channel = supabase
      .channel(`players_${currentPlayer.room_id}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "players",
          filter: `id=eq.${currentPlayer.id}`,
        },
        (payload) => {
          console.log("📡 LobbyPhase: Pemain dihapus:", payload);
          // Arahkan pemain ke halaman utama jika mereka dikick
          router.push("/");
          alert(t("kickedFromRoom"));
        }
      )
      .subscribe((status, err) => {
        console.log("📡 LobbyPhase: Status langganan pemain:", status, err ? err.message : "");
      });

    return () => {
      console.log("🔌 LobbyPhase: Membersihkan langganan pemain");
      supabase.removeChannel(channel);
    };
  }, [currentPlayer.room_id, currentPlayer.id, router, t]);

  // Menghasilkan efek tetesan darah
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

    const textInterval = setInterval(() => {
      setAtmosphereText(atmosphereTexts[Math.floor(Math.random() * atmosphereTexts.length)])
    }, 2500)

    return () => {
      clearInterval(flickerInterval)
      clearInterval(textInterval)
    }
  }, [atmosphereTexts])

  // Menangani pemilihan karakter dengan auto-save dan menutup dialog
  const handleCharacterSelect = async (characterValue: string) => {
    const previousCharacter = selectedCharacter;

    try {
      setSelectedCharacter(characterValue);
      console.log(`✅ LobbyPhase: Memilih karakter: ${characterValue} untuk pemain ${currentPlayer.id}`);

      const { error } = await supabase
        .from("players")
        .update({ character_type: characterValue })
        .eq("id", currentPlayer.id)

      if (error) {
        console.error("❌ LobbyPhase: Gagal memperbarui karakter:", error)
        setSelectedCharacter(previousCharacter); 
        alert("Gagal memperbarui karakter: " + error.message)
        return
      }

      console.log(`✅ LobbyPhase: Karakter diperbarui menjadi ${selectedCharacter} untuk pemain ${currentPlayer.id}`)
      setIsCharacterDialogOpen(false)
    } catch (error) {
      console.error("❌ LobbyPhase: Gagal memperbarui karakter:", error)
      setSelectedCharacter(previousCharacter);
      alert("Gagal memperbarui karakter: " + (error instanceof Error ? error.message : "Kesalahan tidak diketahui"))
    }
  }

  const handleStartGame = async () => {
    if (!currentPlayer.isHost || !gameLogic.room?.id) return
    try {
      // Sync server time before starting countdown
      await syncServerTime()

      // Use server RPC to set countdown_start with server time
      const { error } = await supabase.rpc("set_countdown_start", {
        room_id: gameLogic.room.id,
      })

      if (error) {
        console.error("Gagal memulai countdown:", error)
        // Fallback to client time if RPC fails
        await supabase
          .from("game_rooms")
          .update({ countdown_start: new Date().toISOString() })
          .eq("id", gameLogic.room.id)
      }
    } catch (error) {
      console.error("Gagal memulai countdown:", error)
    }
  }

  const sortedPlayers = [...players].sort((a, b) => {
    if (a.id === currentPlayer.id) return -1
    if (b.id === currentPlayer.id) return 1
    return 0
  })

  console.log("🔍 LobbyPhase: Current Player:", currentPlayer)
  console.log("🔍 LobbyPhase: Sorted Players:", sortedPlayers)
  console.log("🎨 LobbyPhase: Keputusan render:", {
    countdown,
    roomCountdownStart: room?.countdown_start,
  })

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      {/* Latar belakang bernoda darah */}
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

      {/* Tetesan darah */}
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

      {/* Tengkorak dan tulang melayang */}
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

      {/* Lapisan goresan */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJzY3JhdGNoZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48cGF0aCBkPSJNMCAwTDUwMCA1MDAiIHN0cm9rZT0icmdiYSgyNTUsMCwwLDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48cGF0aCBkPSJNMCAxMDBMNTAwIDYwMCIgc3Ryb2tlPSJyZ2JhKDI1NSwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDIwMEw1MDAgNzAwIiBzdHJva2U9InJnYmEoMjU1LDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NjcmF0Y2hlcykiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] opacity-20" />

      {/* Noda darah di sudut */}
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

      {countdown !== null && countdown > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black flex items-center justify-center z-50"
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

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <HeartPulse className="w-12 h-12 text-red-500 mr-4 animate-pulse" />
            <h1
              className={`text-6xl font-bold font-mono tracking-wider transition-all duration-150 ${
                flickerText ? "text-red-500 opacity-100" : "text-red-900 opacity-30"
              } drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("lobby")}
            </h1>
            <HeartPulse className="w-12 h-12 text-red-500 ml-4 animate-pulse" />
          </div>

          <p className="text-red-400/80 text-xl font-mono animate-pulse tracking-wider">{atmosphereText}</p>
        </div>

        {/* Grid Pemain */}
        <div className="max-w-5xl mx-auto mb-8 md:h-auto h-[calc(100vh-150px)] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {sortedPlayers.map((player) => (
              <div
                key={player.id}
                className="relative bg-black/40 border border-red-900/50 rounded-lg p-4 lg:mx-2 md:mx-5 mx-10 m-2 hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]"
              >
                <div className="absolute -top-2 -left-2 text-red-500">
                  <Ghost className="w-5 h-5" />
                </div>

                <SoulStatus
                  player={{
                    ...player,
                    health: player.health || 3,
                    maxHealth: player.maxHealth || 3,
                    score: player.score || 0,
                    character_type: player.character_type,
                  }}
                  isCurrentPlayer={player.id === currentPlayer.id}
                  variant="detailed"
                  showDetailed={true}
                />

                {player.isHost && (
                  <div className="absolute -bottom-2 -right-2 text-xs bg-red-900 text-white px-2 py-1 rounded font-mono">
                    TUAN RUMAH
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Kontrol Permainan */}
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center space-x-4 text-red-400 font-mono text-lg">
            <Users className="w-6 h-6" />
            <span className="tracking-wider">{players.length} {t("cursedSouls")}</span>
            <Zap className="w-6 h-6 animate-pulse" />
          </div>  
        </div>

        {/* Tombol Pilih Karakter */}
        {!currentPlayer.isHost && (
          <>
            {/* Tampilan Smartphone */}
            <div className="md:hidden fixed bottom-4 left-0 w-full px-4 z-30 bg-black/80">
              <Button
                onClick={() => setIsCharacterDialogOpen(true)}
                className="w-full relative overflow-hidden bg-gradient-to-r from-gray-900 to-gray-700 hover:from-gray-800 hover:to-gray-600 text-white font-mono text-base px-4 py-3 rounded-lg border-2 border-gray-700 shadow-[0_0_20px_rgba(107,114,128,0.3)] transition-all duration-300 group"
              >
                <span className="relative z-10">{t("selectCharacter")}</span>
                <span className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-white" />
              </Button>
            </div>
            {/* Tampilan Desktop */}
            <div className="hidden md:block fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 max-w-md w-full px-4">
              <Button
                onClick={() => setIsCharacterDialogOpen(true)}
                className="w-full relative overflow-hidden bg-gradient-to-r from-gray-900 to-gray-700 hover:from-gray-800 hover:to-gray-600 text-white font-mono text-xl px-10 py-6 rounded-lg border-2 border-gray-700 shadow-[0_0_20px_rgba(107,114,128,0.3)] transition-all duration-300 group"
              >
                <span className="relative z-10">{t("selectCharacter")}</span>
                <span className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-white" />
              </Button>
            </div>
          </>
        )}

        {/* Dialog Pemilihan Karakter */}
        <Dialog open={isCharacterDialogOpen} onOpenChange={setIsCharacterDialogOpen}>
          <DialogContent className="bg-black/95 text-white border-red-500/50 max-w-lg rounded-xl p-4 sm:p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-2xl sm:text-3xl font-bold text-red-400 font-mono tracking-wide">
                {t("selectCharacter")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 sm:py-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {characterOptions.map((character) => (
                  <div
                    key={character.value}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleCharacterSelect(character.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCharacterSelect(character.value)}
                    className={`relative flex flex-col items-center p-3 sm:p-4 rounded-lg cursor-pointer transition-all duration-300
                      ${
                        selectedCharacter === character.value
                          ? "border-2 border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.7)] bg-red-900/30"
                          : "border border-white/20 bg-white/10 hover:bg-red-500/20 hover:shadow-[0_0_8px_rgba(255,0,0,0.5)]"
                      }
                      hover:scale-105`}
                  >
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-2">
                      <Image
                        src={character.gif}
                        alt={character.alt}
                        fill
                        className="object-contain"
                        unoptimized
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                    <span className="text-white font-mono text-xs sm:text-sm text-center">{character.name}</span>
                    {selectedCharacter === character.value && (
                      <span className="absolute top-1 sm:top-2 right-1 sm:right-2 text-red-400 text-xs font-bold">✔</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
          width: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(26, 0, 0, 0.8);
          border-left: 2px solid rgba(255, 0, 0, 0.3);
          box-shadow: inset 0 0 6px rgba(255, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b0000, #ff0000);
          border-radius: 6px;
          border: 2px solid rgba(255, 0, 0, 0.5);
          box-shadow: 0 0 8px rgba(255, 0, 0, 0.7);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #ff0000, #8b0000);
          box-shadow: 0 0 12px rgba(255, 0, 0, 0.9);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #ff0000 rgba(26, 0, 0, 0.8);
        }
      `}</style>
    </div>
  );
}