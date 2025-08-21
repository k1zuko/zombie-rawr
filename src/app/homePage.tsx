"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Gamepad2, Users, Play, Hash, Zap, Skull, Bone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next"; // Impor hook untuk terjemahan
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import toast, { Toaster } from "react-hot-toast";

// Types for TypeScript
interface BloodDrip {
  id: number;
  left: number;
  speed: number;
  delay: number;
  opacity: number;
}

interface FloatingIcon {
  id: number;
  left: number;
  top: number;
  fontSize: number;
  animationDelay: number;
  animationDuration: number;
  isSkull: boolean;
}

export default function HomePage() {
  const { t, i18n } = useTranslation(); // Hook untuk terjemahan
  const [gameCode, setGameCode] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Atmosphere texts
  const atmosphereTexts = useMemo(() => [t("atmosphereText")], [t]);

  // Blood drips with precomputed opacity
  const bloodDrips = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        speed: 0.5 + Math.random() * 2,
        delay: Math.random() * 5,
        opacity: 0.7 + Math.random() * 0.3,
      })),
    []
  );

  // Blood spots
  const bloodSpots = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        left: i * 20 + 5,
        top: i * 20 + 5,
        opacity: 0.3 + (i % 4) * 0.1,
      })),
    []
  );

  // Floating icons
  const floatingIcons = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        left: i * 20 + 10,
        top: i * 20 + 10,
        fontSize: 2 + (i % 3),
        animationDelay: i * 0.5,
        animationDuration: 15 + (i % 5),
        isSkull: i % 2 === 0,
      })),
    []
  );

  // Debounced game code handler
  const handleGameCodeChange = useCallback(
    debounce((value: string) => {
      let processedCode = value.toUpperCase().slice(0, 6);
      try {
        if (value.includes("http") && value.includes("?code=")) {
          const url = new URL(value);
          const codeFromUrl = url.searchParams.get("code");
          if (codeFromUrl) {
            processedCode = codeFromUrl.toUpperCase().slice(0, 6);
          }
        }
      } catch (error) {
        console.warn("Invalid URL, continuing as normal.");
      }
      setGameCode(processedCode);
    }, 200),
    []
  );

  // Immediate nickname handler
  const handleNicknameChange = useCallback(
    (value: string) => {
      setNickname(value.slice(0, 20));
    },
    []
  );

  // Handle bahasa change
  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem("language", value); // Simpan preferensi bahasa di localStorage
  };

  // Handle URL code
  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) {
      setGameCode(codeFromUrl.toUpperCase());
      window.history.replaceState(null, "", "/");
    }

    const langFromUrl = searchParams.get("lng");
    if (langFromUrl && i18n.language !== langFromUrl) {
      handleLanguageChange(langFromUrl);
    }

    if (searchParams.get("kicked") === "1") {
      toast.error(t("youWereKicked"));
      window.history.replaceState(null, "", "/");
    }

    if (searchParams.get("isHost") === "0") {
      toast.error(t("notHost"));
      window.history.replaceState(null, "", "/");
    }
  }, [searchParams, i18n.language]);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Host game
  const handleHostGame = useCallback(() => {
    setIsCreating(true);
    router.push("/quiz-select");
  }, [router]);

  // Join game
  const handleJoinGame = useCallback(async () => {
    if (!gameCode || !nickname) {
      setErrorMessage(t("errorMessages.missingInput"));
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);

    try {
      const { data: room, error } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("room_code", gameCode.toUpperCase())
        .single();

      if (error || !room) {
        setErrorMessage(t("errorMessages.roomNotFound"));
        return;
      }

      const { count } = await supabase
        .from("players")
        .select("*", { count: "exact" })
        .eq("room_id", room.id);

      if (count && count >= room.max_players) {
        setErrorMessage(t("errorMessages.roomFull"));
        return;
      }

      const { error: playerError } = await supabase.from("players").insert({
        room_id: room.id,
        nickname,
        character_type: `robot${Math.floor(Math.random() * 4) + 1}`,
      });

      if (playerError) throw playerError;

      localStorage.setItem("nickname", nickname);
      localStorage.setItem("roomCode", gameCode.toUpperCase());

      router.push(`/game/${gameCode.toUpperCase()}`);
    } catch (error) {
      console.error("Error joining game:", error);
      setErrorMessage(t("errorMessages.joinFailed"));
    } finally {
      setIsJoining(false);
    }
  }, [gameCode, nickname, router, t]);

  // Settings navigation
  const handleSettingsClick = useCallback(() => {
    router.push("/questions");
  }, [router]);

  // Fungsi untuk mengganti bahasa
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5">
        {isClient && (
          <div className="absolute inset-0 opacity-20">
            {bloodSpots.map((spot) => (
              <div
                key={spot.id}
                className="absolute w-64 h-64 bg-red-900 rounded-full mix-blend-multiply blur-xl"
                style={{
                  left: `${spot.left}%`,
                  top: `${spot.top}%`,
                  opacity: spot.opacity,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {isClient &&
        bloodDrips.map((drip) => (
          <div
            key={drip.id}
            className="absolute top-0 w-0.5 h-20 bg-red-600/80 animate-fall"
            style={{
              left: `${drip.left}%`,
              animation: `fall ${drip.speed}s linear ${drip.delay}s infinite`,
              opacity: drip.opacity,
              willChange: "transform",
            }}
          />
        ))}

      {isClient && (
        <div className="absolute inset-0 pointer-events-none">
          {floatingIcons.map((icon) => (
            <div
              key={icon.id}
              className="absolute text-red-900/20 animate-float"
              style={{
                left: `${icon.left}%`,
                top: `${icon.top}%`,
                fontSize: `${icon.fontSize}rem`,
                animationDelay: `${icon.animationDelay}s`,
                animationDuration: `${icon.animationDuration}s`,
                willChange: "transform",
              }}
            >
              {icon.isSkull ? <Skull aria-hidden="true" /> : <Bone aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 text-red-500 hover:bg-red-900/20"
          onClick={handleSettingsClick}
          aria-label="Open settings"
        >
          <Gamepad2 className="h-6 w-6 animate-pulse" />
        </Button>

        {/* Tombol pemilihan bahasa */}
        <div className="absolute top-4 right-4 space-x-2">
          <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger
              className="bg-black/50 border-red-500/50 text-red-400 
               focus:ring-0 focus:outline-none 
               data-[state=open]:bg-black/80 data-[state=open]:border-red-500"
            >
              <SelectValue placeholder={t("selectLanguage")} />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border border-red-500/50 text-red-400">
              <SelectItem value="en" className="focus:bg-red-500/20 focus:text-red-300">
                English
              </SelectItem>
              <SelectItem value="id" className="focus:bg-red-500/20 focus:text-red-300">
                Indonesia
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12 mt-5 pt-12 lg:mt-0 lg:pt-0"
          >
            <h1
              className="text-6xl md:text-8xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("title")}
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-red-400/80 text-lg md:text-2xl font-mono tracking-wider"
            >
              {atmosphereTexts[0]}
            </motion.p>
            {errorMessage && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-600 text-lg font-mono mt-4"
              >
                {errorMessage}
              </motion.p>
            )}
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              whileHover={{ scale: 1.02 }}
              className="group"
            >
              <Card className="bg-black/40 border-red-900/50 hover:border-red-500 transition-all duration-300 h-full shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                <CardHeader className="text-center pb-6">
                  <motion.div
                    className="w-20 h-20 bg-gradient-to-br from-red-900 to-black border-2 border-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.7)] transition-all duration-300"
                    whileHover={{ rotate: -5 }}
                  >
                    <Hash className="w-10 h-10 text-red-400" aria-hidden="true" />
                  </motion.div>
                  <CardTitle className="text-3xl font-bold text-red-400 font-mono mb-2">
                    {t("joinGame")}
                  </CardTitle>
                  <CardDescription className="text-red-400/80 text-lg font-mono">
                    {t("joinDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-0">
                  <div className="space-y-4">
                    <div>
                      <Input
                        placeholder={t("gameCodePlaceholder")}
                        value={gameCode}
                        onChange={(e) => handleGameCodeChange(e.target.value)}
                        className="bg-black/50 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-center text-xl font-mono h-12 rounded-xl focus:border-red-500 focus:ring-red-500/30"
                        aria-label="Game code"
                      />
                    </div>
                    <div>
                      <Input
                        placeholder={t("nicknamePlaceholder")}
                        value={nickname}
                        onChange={(e) => handleNicknameChange(e.target.value)}
                        className="bg-black/50 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-center text-xl font-mono h-12 rounded-xl focus:border-red-500 focus:ring-red-500/30"
                        maxLength={20}
                        aria-label="Nickname"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleJoinGame}
                    disabled={!gameCode || !nickname || isJoining}
                    className="w-full bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-mono text-lg py-4 rounded-xl border-2 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:shadow-[0_0_20px_rgba(239,68,68,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                    aria-label={isJoining ? t("joining") : t("joinButton")}
                  >
                    <span className="relative z-10 flex items-center">
                      {isJoining ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                          className="w-5 h-5 mr-2"
                        >
                          <Zap className="w-5 h-5" aria-hidden="true" />
                        </motion.div>
                      ) : (
                        <Hash className="w-5 h-5 mr-2" aria-hidden="true" />
                      )}
                      {isJoining ? t("joining") : t("joinButton")}
                    </span>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              whileHover={{ scale: 1.02 }}
              className="group"
            >
              <Card className="bg-black/40 border-red-900/50 hover:border-red-500 transition-all duration-300 h-full shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                <CardHeader className="text-center pb-6">
                  <motion.div
                    className="w-20 h-20 bg-gradient-to-br from-red-900 to-black border-2 border-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.7)] transition-all duration-300"
                    whileHover={{ rotate: 5 }}
                  >
                    <Users className="w-10 h-10 text-red-400" aria-hidden="true" />
                  </motion.div>
                  <CardTitle className="text-3xl font-bold text-red-400 font-mono mb-2">
                    {t("hostGame")}
                  </CardTitle>
                  <CardDescription className="text-red-400/80 text-lg font-mono">
                    {t("hostDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    onClick={handleHostGame}
                    disabled={isCreating}
                    className="w-full bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-mono text-lg py-4 rounded-xl border-2 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:shadow-[0_0_20px_rgba(239,68,68,0.7)] transition-all duration-300 group"
                    aria-label={isCreating ? t("creatingRoom") : t("createRoomButton")}
                  >
                    <span className="relative z-10 flex items-center">
                      {isCreating ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                          className="w-5 h-5 mr-2"
                        >
                          <Zap className="w-5 h-5" aria-hidden="true" />
                        </motion.div>
                      ) : (
                        <Play className="w-5 h-5 mr-2" aria-hidden="true" />
                      )}
                      {isCreating ? t("creatingRoom") : t("createRoomButton")}
                    </span>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      <Toaster position="top-center" toastOptions={{ style: { background: "#1a0000", color: "#ff4444", border: "1px solid #ff0000" } }} />

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
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b0000, #ff0000);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}