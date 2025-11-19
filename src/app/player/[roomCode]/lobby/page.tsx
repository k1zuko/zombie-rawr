"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Skull,
  Zap,
  Ghost,
  Bone,
  HeartPulse,
  ArrowLeft,
  Play,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, GameRoom, EmbeddedPlayer } from "@/lib/supabase";
import SoulStatus from "@/components/game/SoulStatus";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { syncServerTime, calculateCountdown } from "@/lib/server-time";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useDetectBackAction } from "@/hooks/useDetectBackAction";
import LoadingScreen from "@/components/LoadingScreen"; // Pastikan versi all-in-one

interface ExtendedEmbeddedPlayer extends EmbeddedPlayer {
  is_ready?: boolean;
  wrong_answers?: number;
}

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
];

// Mobile Character Selector (tetap sama)
function MobileCharacterSelector({
  selectedCharacter,
  onSelect,
  isOpen,
  setIsOpen,
}: {
  selectedCharacter: string;
  onSelect: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const selected = characterOptions.find((c) => c.value === selectedCharacter)!;

  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl p-4 flex items-center gap-4 shadow-2xl transition-all duration-300 border border-red-900/50"
      >
        <Image
          src={selected.gif}
          alt={selected.name}
          width={80}
          height={80}
          unoptimized
          className="rounded-lg border border-red-800/50"
        />
        <div className="flex-1 text-left">
          <p className="text-white font-mono text-lg font-bold">{selected.name}</p>
          <p className="text-red-400 text-sm">Tap untuk ganti karakter</p>
        </div>
        {isOpen ? (
          <ChevronUp className="w-7 h-7 text-red-500 animate-pulse" />
        ) : (
          <ChevronDown className="w-7 h-7 text-red-500" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/85 z-40" onClick={() => setIsOpen(false)} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="absolute bottom-full left-0 right-0 mb-3 bg-black/97 border-2 border-red-800/70 rounded-2xl p-6 z-50 shadow-2xl"
            style={{ maxHeight: "70vh" }}
          >
            <div className="grid grid-cols-5 gap-4">
              {characterOptions.map((character) => {
                const isSelected = selectedCharacter === character.value;
                return (
                  <motion.button
                    key={character.value}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => {
                      onSelect(character.value);
                      setIsOpen(false);
                    }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-4 transition-all duration-300
                      ${isSelected
                        ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.9)] ring-4 ring-red-500/60"
                        : "border-white/25 hover:border-red-600/80"
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 bg-red-600/60 z-10 flex items-center justify-center backdrop-blur-sm">
                        <CheckCircle2 className="w-12 h-12 text-white drop-shadow-2xl" />
                      </div>
                    )}
                    <Image src={character.gif} alt={character.name} fill unoptimized className="object-cover" />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode as string;
  const { t } = useTranslation();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<ExtendedEmbeddedPlayer[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<ExtendedEmbeddedPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);                    // ← Kontrol loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCharacterSelectorOpen, setIsCharacterSelectorOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState("robot1");
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // === FETCH DATA DENGAN setIsLoading(false) DI FINALLY ===
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!roomCode) {
        router.replace("/");
        return;
      }

      try {
        setIsLoading(true);

        const { data: roomData, error: roomError } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("room_code", roomCode)
          .single();

        if (roomError || !roomData) {
          toast.error("Room tidak ditemukan!");
          router.replace("/");
          return;
        }

        setRoom(roomData);
        const roomPlayers = (roomData.players as ExtendedEmbeddedPlayer[]) || [];
        setPlayers(roomPlayers);

        const playerId = localStorage.getItem("playerId");
        if (playerId) {
          const player = roomPlayers.find((p) => p.player_id === playerId) || null;
          setCurrentPlayer(player);
          if (player?.character_type) setSelectedCharacter(player.character_type);
        } else {
          toast.error("Tidak dapat mengidentifikasi pemain.");
          router.replace("/");
        }
      } catch (err) {
        console.error(err);
        toast.error("Gagal memuat lobby");
        router.replace("/");
      } finally {
        setIsLoading(false); // ← INI YANG PENTING!
      }
    };

    fetchInitialData();
    syncServerTime();
  }, [roomCode, router]);

  // === REAL-TIME SUBSCRIPTION (tetap sama) ===
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`lobby_${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          const newRoom = payload.new as GameRoom;
          setRoom(newRoom);
          const newPlayers = (newRoom.players as ExtendedEmbeddedPlayer[]) || [];
          setPlayers(newPlayers);

          const playerId = localStorage.getItem("playerId");
          if (playerId) {
            const updatedPlayer = newPlayers.find((p) => p.player_id === playerId) || null;
            setCurrentPlayer(updatedPlayer);
            if (updatedPlayer?.character_type) {
              setSelectedCharacter(updatedPlayer.character_type);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  // === COUNTDOWN (tetap sama) ===
  useEffect(() => {
    if (!room?.countdown_start) {
      setCountdown(null);
      return;
    }
    const updateCountdown = () => {
      const remaining = calculateCountdown(room.countdown_start, 10000);
      setCountdown(remaining);
      return remaining > 0;
    };
    if (updateCountdown()) {
      const timer = setInterval(() => {
        if (!updateCountdown()) clearInterval(timer);
      }, 100);
      return () => clearInterval(timer);
    }
  }, [room?.countdown_start]);

  // === AUTO REDIRECT KETIKA GAME MULAI ===
  useEffect(() => {
    if (room?.status === "playing" || (countdown !== null && countdown <= 0)) {
      router.replace(`/player/${roomCode}/quiz`);
    }
  }, [room?.status, countdown, roomCode, router]);

  // === CHARACTER SELECTION (tetap sama) ===
  const handleCharacterSelect = async (characterValue: string) => {
    if (!currentPlayer || characterValue === selectedCharacter) return;

    const previousCharacter = selectedCharacter;
    try {
      setSelectedCharacter(characterValue);
      const updatedPlayers = players.map((p) =>
        p.player_id === currentPlayer.player_id ? { ...p, character_type: characterValue } : p
      );
      setPlayers(updatedPlayers);

      const { error } = await supabase
        .from("game_rooms")
        .update({ players: updatedPlayers })
        .eq("id", room?.id);

      if (error) throw error;
    } catch (error) {
      setSelectedCharacter(previousCharacter);
      toast.error("Gagal mengganti karakter");
    }
  };

  // === EXIT LOBBY (tetap sama) ===
  const handleExitLobby = async () => {
    if (!currentPlayer || !room) return;
    try {
      localStorage.setItem("exitBySelf", "1");
      const updatedPlayers = room.players.filter((p) => p.player_id !== currentPlayer.player_id);
      await supabase.from("game_rooms").update({ players: updatedPlayers }).eq("id", room.id);
      router.replace("/");
    } catch (err) {
      console.error("Gagal keluar lobby:", err);
    } finally {
      setIsExitDialogOpen(false);
    }
  };

  // === START GAME (Host only) ===
  const startGame = async () => {
    if (!room?.id || !currentPlayer?.is_host || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("game_rooms")
        .update({
          status: "playing",
          game_start_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id);

      if (error) throw error;
    } catch (error) {
      toast.error("Gagal memulai permainan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedPlayers = useMemo(() => {
    if (!currentPlayer) return players;
    return [...players].sort((a, b) => {
      if (a.player_id === currentPlayer.player_id) return -1;
      if (b.player_id === currentPlayer.player_id) return 1;
      if (a.is_host) return -1;
      if (b.is_host) return 1;
      return 0;
    });
  }, [players, currentPlayer]);

  useDetectBackAction(setIsExitDialogOpen);

  // === RENDER DENGAN LOADINGSCREEN (INI YANG BARU!) ===
  return (
    <LoadingScreen minDuration={500} isReady={!isLoading && !!currentPlayer && !!room}>
      {/* SELURUH KONTEN LOBBY */}
      <div className="min-h-screen bg-black relative overflow-hidden select-none">
        {/* Countdown Overlay */}
        {countdown !== null && countdown > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black flex items-center justify-center z-50">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-[20rem] md:text-[30rem] font-mono font-bold text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]"
            >
              {countdown}
            </motion.div>
          </motion.div>
        )}

        <div className="relative z-10 mx-auto p-4 pt-6 pb-28 max-w-7xl">
          <motion.header initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse">
              {t("waitingRoomTitle")}
            </h1>
          </motion.header>

          {/* Daftar Player */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 px-2">
            {sortedPlayers.map((player) => (
              <div
                key={player.player_id}
                className="relative bg-black/40 border border-red-900/50 rounded-lg p-4 hover:border-red-500 transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]"
              >
              <SoulStatus
                player={{
                  ...player,
                  id: player.player_id,
                }}
                isCurrentPlayer={currentPlayer ? player.player_id === currentPlayer.player_id : false}
              />
                {player.is_host && (
                  <div className="absolute -bottom-2 -right-2 text-xs bg-red-900 text-white px-2 py-1 rounded font-mono">
                    HOST
                  </div>
                )}
              </div>
            ))}
          </div>

        {/* Tombol Start untuk Host */}
            {currentPlayer?.is_host && (
              <div className="text-center mt-10">
                <Button
                  onClick={startGame}
                  disabled={isSubmitting || countdown !== null}
                  className="bg-red-700 hover:bg-red-600 text-white font-mono text-xl px-8 py-4 rounded-lg shadow-lg"
                >
                  {t("startGame")}
                </Button>
              </div>
            )}

            {/* Tombol Bawah Non-Host */}
            {currentPlayer && !currentPlayer.is_host && (
              <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-md px-4">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setIsExitDialogOpen(true)}
                    variant="outline"
                    size="icon"
                    className="bg-red-900/80 border-red-600 hover:bg-red-800 text-white rounded-full p-3 shadow-lg"
                  >
                    <ArrowLeft className="w-7 h-7" />
                  </Button>

                  {isMobile ? (
                    <MobileCharacterSelector
                      selectedCharacter={selectedCharacter}
                      onSelect={handleCharacterSelect}
                      isOpen={isCharacterSelectorOpen}
                      setIsOpen={setIsCharacterSelectorOpen}
                    />
                  ) : (
                    <Button
                      onClick={() => setIsCharacterSelectorOpen(true)}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-mono text-xl px-10 py-6 rounded-lg shadow-lg"
                    >
                      {t("selectCharacter")}
                    </Button>
                  )}
                </div>
              </div>
            )}
        </div>

        {/* Dialog Keluar */}
        <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
          <DialogContent className="bg-black/95 border border-red-600/70 text-red-400 rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-red-500">{t("exitConfirm")}</DialogTitle>
            </DialogHeader>
            <DialogFooter className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsExitDialogOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleExitLobby} className="bg-red-600 hover:bg-red-700 text-white">
                {t("exit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Pilih Karakter Desktop */}
        {!isMobile && isCharacterSelectorOpen && (
          <Dialog open={isCharacterSelectorOpen} onOpenChange={setIsCharacterSelectorOpen}>
            <DialogContent className="bg-black/95 border-red-800/60 text-white p-6 max-w-lg rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold font-mono text-red-500">Pilih Karakter</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-5 gap-4 mt-6">
                {characterOptions.map((character) => (
                  <motion.button
                    key={character.value}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      handleCharacterSelect(character.value);
                      setIsCharacterSelectorOpen(false);
                    }}
                    className={`relative aspect-square rounded-xl overflow-hidden border-4 ${
                      selectedCharacter === character.value
                        ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.9)]"
                        : "border-white/20 hover:border-red-600"
                    }`}
                  >
                    {selectedCharacter === character.value && (
                      <div className="absolute inset-0 bg-red-600/50 z-10 flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 text-white" />
                      </div>
                    )}
                    <Image src={character.gif} alt={character.name} fill unoptimized className="object-cover" />
                  </motion.button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </LoadingScreen>
  );
}