
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
import { Gamepad2, Users, Play, Hash, Zap, Skull, Bone, RefreshCw, HelpCircle, RotateCw, LogOut } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

// Custom debounce function
// const debounce = (func: Function, delay: number) => {
//   let timeout: NodeJS.Timeout;
//   return (...args: any[]) => {
//     clearTimeout(timeout);
//     timeout = setTimeout(() => func(...args), delay);
//   };
// };

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const [gameCode, setGameCode] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isStartingTryout, setIsStartingTryout] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [dripCount, setDripCount] = useState(8); // server fallback
  const [iconCount, setIconCount] = useState(5); // server fallback
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openHowToPlay, setOpenHowToPlay] = useState(false);
  const [showTooltipOnce, setShowTooltipOnce] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<"join" | "play">("join");

  // State untuk debug mode
  const [debugMode, setDebugMode] = useState(false);
  const [massJoinInProgress, setMassJoinInProgress] = useState(false);
  const [massJoinStatus, setMassJoinStatus] = useState("");
  const [joinCount, setJoinCount] = useState(0);

  // Atmosphere text
  const atmosphereText = t("atmosphereText");

  // Blood drip effects
  const bloodDrips = useMemo(() => {
    if (!isClient) return [];
    return Array.from({ length: dripCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      speed: 2 + Math.random() * 1.5,
      delay: Math.random() * 5,
      opacity: 0.7 + Math.random() * 0.3,
    }));
  }, [isClient, dripCount]);

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
  const floatingIcons = useMemo(() => {
    if (!isClient) return [];
    return Array.from({ length: iconCount }, (_, i) => ({
      id: i,
      left: i * 20 + 10,
      top: i * 20 + 10,
      fontSize: 2 + (i % 3),
      animationDelay: i * 0.5,
      animationDuration: 15 + (i % 5),
      isSkull: i % 2 === 0,
    }));
  }, [isClient, iconCount]);

  // Responsive drip and icon counts
  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth < 640;
      setDripCount(mobile ? 4 : 8);
      setIconCount(mobile ? 3 : 5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Random nickname generator
  const generateRandomNickname = useCallback(() => {
    const prefixes = [
      "Salsa", "Zombi", "Vampir", "Downey", "Robert", "Windah",
      "Neko", "Shadow", "Ghost", "Pixel", "Nova", "Luna",
      "Blaze", "Frost", "Echo", "Cyber", "Storm", "Phantom",
      "Night", "Inferno", "Zephyr", "Hunter", "Draco", "Falcon",
      "Toxic", "Venom", "Aqua", "Raven", "Sky", "Zero",
      "Jinx", "Hex", "Bolt", "Ash", "Flame", "Magma",
      "Comet", "Glitch", "Vortex", "Wraith", "Slayer", "Bane",
      "Arcade", "Pixelz", "Mysterio", "Oblivion", "Hydra", "Titan"
    ];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNumber = Math.floor(Math.random() * 10000);
    const newNickname = `${randomPrefix}${randomNumber}`;
    setNickname(newNickname);
  }, []);

  // Game code handler with debouncing
  const handleGameCodeChange = useCallback(
    ((value: string) => {
      let processedCode = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (value.includes("http") && value.includes("?code=")) {
        try {
          const url = new URL(value);
          const codeFromUrl = url.searchParams.get("code");
          if (codeFromUrl) {
            processedCode = codeFromUrl.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
          }
        } catch (error) {
          console.warn("URL tidak valid, diabaikan.");
          return;
        }
      }
      setGameCode(processedCode);
    }),
    []
  );

  // Nickname handler with debouncing
  const handleNicknameChange = useCallback(
    ((value: string) => {
      setNickname(value.slice(0, 20));
    }),
    []
  );

  // // Fungsi untuk melakukan join massal (70x)
  // const handleMassJoin = useCallback(async () => {
  //   if (!gameCode || !nickname) {
  //     toast.error("Game code dan nickname harus diisi!");
  //     return;
  //   }

  //   setMassJoinInProgress(true);
  //   setJoinCount(0);
    
  //   for (let i = 0; i < 12; i++) {
  //     try {
  //       // Generate nickname unik untuk setiap join
  //       const uniqueNickname = `${nickname}_${i + 1}`;
        
  //       // Proses join game (sama seperti handleJoinGame)
  //       const { data: room, error: roomError } = await supabase
  //         .from("game_rooms")
  //         .select("*")
  //         .eq("room_code", gameCode.toUpperCase())
  //         .single();

  //       if (roomError || !room) {
  //         setMassJoinStatus(`Gagal ${i+1}: Room tidak ditemukan`);
  //         continue;
  //       }

  //       // Check if nickname is already taken
  //       const { data: existingPlayers, error: checkError } = await supabase
  //         .from("players")
  //         .select("nickname")
  //         .eq("room_id", room.id)
  //         .eq("nickname", uniqueNickname)
  //         .maybeSingle();

  //       if (checkError) {
  //         setMassJoinStatus(`Gagal ${i+1}: Error cek nickname`);
  //         continue;
  //       }

  //       if (existingPlayers) {
  //         setMassJoinStatus(`Gagal ${i+1}: Nickname sudah digunakan`);
  //         continue;
  //       }

  //       // Insert player
  //       const { error: playerError } = await supabase
  //         .from("players")
  //         .insert({
  //           room_id: room.id,
  //           nickname: uniqueNickname,
  //           character_type: `robot${Math.floor(Math.random() * 10) + 1}`,
  //         });

  //       if (playerError) {
  //         setMassJoinStatus(`Gagal ${i+1}: ${playerError.message}`);
  //         continue;
  //       }

  //       setJoinCount(prev => prev + 1);
  //       setMassJoinStatus(`Berhasil join ke-${i+1} dengan nickname: ${uniqueNickname}`);
        
  //       // Delay antar request untuk menghindari rate limiting
  //       await new Promise(resolve => setTimeout(resolve, 500));
        
  //     } catch (error) {
  //       console.error(`Error pada join ke-${i+1}:`, error);
  //       setMassJoinStatus(`Error pada join ke-${i+1}`);
  //     }
  //   }
    
  //   setMassJoinInProgress(false);
  //   toast.success(`Proses selesai! Berhasil join ${joinCount} dari 70 kali.`);
  // }, [gameCode, nickname, joinCount]);

  //  // Kombinasi keyboard untuk mengaktifkan debug mode (Ctrl+Shift+D)
  // useEffect(() => {
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     if (e.ctrlKey && e.shiftKey && e.key === 'D') {
  //       setDebugMode(prev => !prev);
  //       toast.success(`Debug mode ${!debugMode ? 'diaktifkan' : 'dinonaktifkan'}`);
  //     }
  //   };

  //   window.addEventListener('keydown', handleKeyDown);
  //   return () => window.removeEventListener('keydown', handleKeyDown);
  // }, [debugMode]);

  // Language change handler
  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    if (typeof window !== "undefined") localStorage.setItem("language", value);
  };

  // Handle URL parameters
  useEffect(() => {
    const updates: Record<string, string | null> = {};
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) {
      setGameCode(codeFromUrl.toUpperCase());
      updates.code = null;
    }

    if (searchParams.get("kicked") === "1") {
      toast.error(t("youWereKicked"));
      updates.kicked = null;
    }

    if (searchParams.get("isHost") === "0") {
      toast.error(t("notHost"));
      updates.isHost = null;
    }

    if (Object.keys(updates).length > 0) {
      window.history.replaceState(null, "", "/");
    }
  }, [searchParams, t]);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show How to Play dialog on first visit
  useEffect(() => {
    if (!isClient) return;
    const timer = setTimeout(() => {
      const seen = typeof window !== "undefined" ? localStorage.getItem("seenHowToPlay") : null;
      if (!seen) {
        setOpenHowToPlay(true);
        localStorage.setItem("seenHowToPlay", "1");
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [isClient]);

  // Host game
  const handleHostGame = useCallback(() => {
    setIsCreating(true);
    if (navigator.vibrate) navigator.vibrate(50);
    router.push("/quiz-select");
  }, [router]);

  // Join game
  const handleJoinGame = useCallback(async () => {
    if (isJoining) return;
    if (!gameCode || !nickname) {
      setErrorMessage(t("errorMessages.missingInput"));
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);

    try {
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("room_code", gameCode.toUpperCase())
        .single();

      if (roomError || !room) {
        toast.error(t("errorMessages.roomNotFound"));
        setIsJoining(false);
        return;
      }

      const { data: existingPlayers, error: checkError } = await supabase
        .from("players")
        .select("nickname")
        .eq("room_id", room.id)
        .eq("nickname", nickname)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking nickname:", checkError);
        toast.error(t("errorMessages.checkNicknameFailed"));
        setIsJoining(false);
        return;
      }

      if (existingPlayers) {
        toast.error(t("errorMessages.nicknameTaken"));
        setIsJoining(false);
        return;
      }

      const { error: playerError } = await supabase
        .from("players")
        .insert({
          room_id: room.id,
          nickname,
          character_type: `robot${Math.floor(Math.random() * 10) + 1}`,
        })
        .select()
        .single();

      if (playerError) {
        if (playerError.code === "23505") {
          toast.error(t("errorMessages.nicknameTaken"));
        } else {
          toast.error(t("errorMessages.joinFailed"));
        }
        setIsJoining(false);
        return;
      }

      localStorage.setItem("nickname", nickname);
      localStorage.setItem("roomCode", gameCode.toUpperCase());
      if (navigator.vibrate) navigator.vibrate(50);
      await router.push(`/game/${gameCode.toUpperCase()}`);
    } catch (error) {
      console.error("Error bergabung ke permainan:", error);
      toast.error(t("errorMessages.joinFailed"));
      setIsJoining(false);
    }
  }, [gameCode, nickname, router, t, isJoining]);

  // Start Play mode
  const handleStartTryout = useCallback(() => {
    if (!nickname) {
      setErrorMessage(t("errorMessages.missingNickname"));
      return;
    }

    setIsStartingTryout(true);
    localStorage.setItem("nickname", nickname);
    if (navigator.vibrate) navigator.vibrate(50);
    router.push("/quiz-select-tryout");
  }, [nickname, router, t]);

  // Settings navigation
  const handleSettingsClick = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(50);
    router.push("/questions");
  }, [router]);

  // Logout handler
  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const confirmLogout = async () => {
    setIsLogoutConfirmOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(t("logoutFailed"));
      console.error("Error logging out:", error);
    } else {
      toast.success(t("logoutSuccess"));
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      {/* Background gradient with fog effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5">
        {isClient && (
          <div className="absolute inset-0 opacity-20">
            {bloodSpots.map((spot) => (
              <div
                key={spot.id}
                className="absolute w-32 h-32 sm:w-64 sm:h-64 bg-red-900 rounded-full mix-blend-multiply blur-xl"
                style={{
                  left: `${spot.left}%`,
                  top: `${spot.top}%`,
                  opacity: spot.opacity,
                }}
              />
            ))}
          </div>
        )}
        {/* Fog overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/30 backdrop-blur-sm sm:backdrop-blur-md" />
      </div>

      {isClient &&
        bloodDrips.map((drip) => (
          <motion.div
            key={drip.id}
            initial={{ y: -100 }}
            animate={{ y: "100vh" }}
            transition={{ duration: drip.speed, delay: drip.delay, ease: "linear", repeat: Infinity }}
            className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
            style={{ left: `${drip.left}%`, opacity: 0.6 + Math.random() * 0.2 }}
          />
        ))}

      {isClient && (
        <div className="absolute inset-0 pointer-events-none">
          {floatingIcons.map((icon) => (
            <div
              key={icon.id}
              className="absolute text-red-900/20 animate-float sm:animate-float"
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

      <div className="relative z-10 flex items-center justify-center min-h-screen p-2 sm:p-4">
        {/* Help Circle Button */}
        <div className="absolute top-4 left-4 z-20">
          <TooltipProvider>
            <Tooltip open={showTooltipOnce}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpenHowToPlay(true)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                  aria-label="How to Play"
                >
                  <HelpCircle className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-black text-red-400 border border-red-500/50 font-mono"
              >
                {t("howToPlay")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Dialog open={openHowToPlay} onOpenChange={(isOpen) => {
          setOpenHowToPlay(isOpen);
          if (!isOpen && !localStorage.getItem("seenTooltipOnce")) {
            setShowTooltipOnce(true);
            localStorage.setItem("seenTooltipOnce", "1");
            setTimeout(() => {
              setShowTooltipOnce(false);
            }, 5000);
          }
        }}>
          <AnimatePresence>
            {openHowToPlay && (
              <DialogContent forceMount className="bg-black/80 border-red-500 text-red-400 max-w-sm sm:max-w-lg">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <DialogHeader>
                    <DialogTitle className="text-red-500 text-2xl font-mono">{t("howToPlay")}</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="join" className="mt-4">
                    <TabsList className="grid w-full grid-cols-2 bg-black/50 border-red-500/50">
                      <TabsTrigger value="join" className="text-red-400 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-300 font-mono">{t("join")}</TabsTrigger>
                      <TabsTrigger value="play" className="text-red-400 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-300 font-mono">{t("play")}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="join" asChild>
                      <motion.div
                        className="mt-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="text-xl font-mono mb-2">{t("joinTitle")}</h3>
                        <ol className="list-decimal list-outside pl-6 space-y-2 text-sm sm:text-base font-mono">
                          {Array.isArray(t("joinSteps", { returnObjects: true }))
                            ? (t("joinSteps", { returnObjects: true }) as string[]).map((step: string, idx: number) => (
                              <li key={idx}>{step}</li>
                            ))
                            : <li>{t("errorMessages.noStepsAvailable", "No steps available.")}</li>}
                        </ol>
                      </motion.div>
                    </TabsContent>
                    <TabsContent value="play" asChild>
                      <motion.div
                        className="mt-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="text-xl font-bold mb-2">{t("playTitle")}</h3>
                        <ol className="list-decimal list-outside pl-6 space-y-2 text-sm sm:text-base font-mono">
                          {Array.isArray(t("playSteps", { returnObjects: true }))
                            ? (t("playSteps", { returnObjects: true }) as string[]).map((step: string, idx: number) => (
                              <li key={idx}>{step}
                                {idx === 1 && (
                                  <ul className="list-disc list-outside pl-6 mt-1 space-y-1">
                                    <li>{t("speedRuleCorrect")}</li>
                                    <li>{t("speedRuleWrong")}</li>
                                  </ul>
                                )}
                              </li>
                            ))
                            : <li>{t("errorMessages.noStepsAvailable", "No steps available.")}</li>}
                        </ol>
                      </motion.div>
                    </TabsContent>
                  </Tabs>
                </motion.div>
              </DialogContent>
            )}
          </AnimatePresence>
        </Dialog>

        {/* Language selector */}
        <div className="absolute top-4 right-4 z-20">
          <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger
              className="bg-black/50 border-red-500/50 text-red-400 h-10 sm:h-12 text-sm sm:text-base focus:ring-0 focus:outline-none data-[state=open]:bg-black/80 data-[state=open]:border-red-500"
            >
              <SelectValue placeholder={t("selectLanguage")} />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border border-red-500/50 text-red-400">
              <SelectItem value="en" className="focus:bg-red-500/20 focus:text-red-300 text-sm sm:text-base">
                English
              </SelectItem>
              <SelectItem value="id" className="focus:bg-red-500/20 focus:text-red-300 text-sm sm:text-base">
                Indonesia
              </SelectItem>
              <SelectItem value="de" className="focus:bg-red-500/20 focus:text-red-300 text-sm sm:text-base">
                Deutsch
              </SelectItem>
              <SelectItem value="fr" className="focus:bg-red-500/20 focus:text-red-300 text-sm sm:text-base">
                Français
              </SelectItem>
              <SelectItem value="ja" className="focus:bg-red-500/20 focus:text-red-300 text-sm sm:text-base">
                日本語
              </SelectItem>
              <SelectItem value="es" className="focus:bg-red-500/20 focus:text-red-300 text-sm sm:text-base">
                Español
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8 mt-12 pt-12 sm:mt-0 sm:pt-0"
          >
            <h1
              className="text-6xl md:text-8xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]"
              style={{ textShadow: "0 0 15px rgba(239, 68, 68, 0.9), 0 0 20px rgba(0, 0, 0, 0.5)" }}
            >
              {t("title")}
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-red-400/80 text-base sm:text-lg md:text-2xl font-mono tracking-wider mt-2"
            >
              {atmosphereText}
            </motion.p>
            {errorMessage && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-600 text-sm sm:text-lg font-mono mt-4"
              >
                {errorMessage}
              </motion.p>
            )}
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Combined Join & Play Card */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              whileHover={{ scale: 1.02 }}
              className="group"
            >
              <Card className="bg-black/40 border-red-900/50 hover:border-red-500 transition-all duration-300 h-full shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                <CardHeader className="text-center pb-4 sm:pb-6">
                  <motion.div
                    className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-900 to-black border-2 border-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.7)] transition-all duration-300"
                    whileHover={{ rotate: -3 }}
                  >
                    {tab === "join" ? (
                      <Play className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" />
                    ) : (
                      <Gamepad2 className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" />
                    )}
                  </motion.div>
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-red-400 font-mono mb-2">
                    {tab === "join" ? t("joinGame") : t("tryOut")}
                  </CardTitle>
                  <CardDescription className="text-red-400/80 text-sm sm:text-lg font-mono">
                    {tab === "join" ? t("joinDescription") : t("tryOutDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 pt-0">
                  {/* Tabs for Join vs Play */}
                  <Tabs defaultValue="join" onValueChange={(val) => setTab(val as "join" | "play")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-black/50 border border-red-400 mb-4 sm:mb-6 h-auto">
                      <TabsTrigger
                        value="join"
                        className="text-red-400 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-300 font-mono text-sm sm:text-base transition-all duration-200 w-full"
                      >
                        <Hash className="w-4 h-4 mr-2" />
                        {t("joinGame")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="play"
                        className="text-red-400 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-300 font-mono text-sm sm:text-base transition-all duration-200"
                      >
                        <Gamepad2 className="w-4 h-4 mr-2" />
                        {t("tryOut")}
                      </TabsTrigger>
                    </TabsList>

                    {/* Join Game Tab */}
                    <TabsContent value="join" className="space-y-4 sm:space-y-6 mt-0">
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <Input
                            placeholder={t("gameCodePlaceholder")}
                            value={gameCode}
                            onChange={(e) => handleGameCodeChange(e.target.value)}
                            className="bg-black/50 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-center text-base sm:text-xl font-mono h-10 sm:h-12 rounded-xl focus:border-red-500 focus:ring-red-500/30"
                            aria-label="Kode permainan"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Input
                            placeholder={t("nicknamePlaceholder")}
                            value={nickname}
                            onChange={(e) => handleNicknameChange(e.target.value)}
                            className="bg-black/50 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-center text-base sm:text-xl font-mono h-10 sm:h-12 rounded-xl focus:border-red-500 focus:ring-red-500/30 flex-1"
                            maxLength={20}
                            aria-label="Nama panggilan"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={generateRandomNickname}
                            className="border-red-500/50 text-red-400 hover:bg-red-500/20 h-10 sm:h-12 w-10 sm:w-12"
                            aria-label="Buat nama acak"
                          >
                            <RefreshCw className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        onClick={() => { if (!isJoining) handleJoinGame() }}
                        disabled={!gameCode || !nickname || isJoining}
                        className="w-full bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-mono text-base sm:text-lg py-3 sm:py-4 rounded-xl border-2 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:shadow-[0_0_20px_rgba(239,68,68,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                        aria-label={isJoining ? t("joining") : t("joinButton")}
                        aria-disabled={!gameCode || !nickname || isJoining}
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
                    </TabsContent>

                    {/* Play Tab */}
                    <TabsContent value="play" className="space-y-4 sm:space-y-6 mt-0">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Input
                            placeholder={t("nicknamePlaceholder")}
                            value={nickname}
                            onChange={(e) => handleNicknameChange(e.target.value)}
                            className="bg-black/50 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-center text-base sm:text-xl font-mono h-10 sm:h-12 rounded-xl focus:border-red-500 focus:ring-red-500/30 flex-1"
                            maxLength={20}
                            aria-label="Nama panggilan"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={generateRandomNickname}
                            className="border-red-500/50 text-red-400 hover:bg-red-500/20 h-10 sm:h-12 w-10 sm:w-12"
                            aria-label="Buat nama acak"
                          >
                            <RefreshCw className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        onClick={handleStartTryout}
                        disabled={!nickname || isStartingTryout}
                        className="w-full bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-mono text-base sm:text-lg py-3 sm:py-4 rounded-xl border-2 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:shadow-[0_0_20px_rgba(239,68,68,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                        aria-label={isStartingTryout ? t("starting") : t("start")}
                        aria-disabled={!nickname || isStartingTryout}
                      >
                        <span className="relative z-10 flex items-center">
                          {isStartingTryout ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                              className="w-5 h-5 mr-2"
                            >
                              <Zap className="w-5 h-5" aria-hidden="true" />
                            </motion.div>
                          ) : (
                            <Gamepad2 className="w-5 h-5 mr-2" aria-hidden="true" />
                          )}
                          {isStartingTryout ? t("starting") : t("start")}
                        </span>
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>

            {/* Host Game Card */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              whileHover={{ scale: 1.02 }}
              className="group"
            >
              <Card className="bg-black/40 border-red-900/50 hover:border-red-500 transition-all duration-300 h-full shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                <CardHeader className="text-center pb-4 sm:pb-6">
                  <motion.div
                    className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-900 to-black border-2 border-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.7)] transition-all duration-300"
                    whileHover={{ rotate: 5 }}
                  >
                    <Users className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" aria-hidden="true" />
                  </motion.div>
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-red-400 font-mono mb-2">
                    {t("hostGame")}
                  </CardTitle>
                  <CardDescription className="text-red-400/80 text-sm sm:text-lg font-mono">
                    {t("hostDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    onClick={handleHostGame}
                    disabled={isCreating}
                    className="w-full bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 hover:to-red-600 text-white font-mono text-base sm:text-lg py-3 sm:py-4 rounded-xl border-2 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:shadow-[0_0_20px_rgba(239,68,68,0.7)] transition-all duration-300 group"
                    aria-label={isCreating ? t("creatingRoom") : t("createRoomButton")}
                    aria-disabled={isCreating}
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

      {/* Tombol Debug Mode (hanya muncul jika debugMode true) */}
      {/*
      {debugMode && (
        <div className="fixed bottom-4 right-4 z-50 bg-black/80 p-4 rounded-lg border border-red-500">
          <h3 className="text-red-500 font-bold mb-2">Debug Mode</h3>
          <Button 
            onClick={handleMassJoin} 
            disabled={massJoinInProgress}
            className="w-full mb-2 bg-red-700 hover:bg-red-600"
          >
            {massJoinInProgress ? `Joining... (${joinCount}/70)` : 'Join 70x'}
          </Button>
          {massJoinStatus && (
            <p className="text-red-400 text-xs mt-2">{massJoinStatus}</p>
          )}
          <p className="text-red-400 text-xs mt-2">
            Tekan Ctrl+Shift+D untuk menyembunyikan
          </p>
        </div>
      )}
      */}

      <Dialog open={isLogoutConfirmOpen} onOpenChange={setIsLogoutConfirmOpen}>
        <AnimatePresence>
          {isLogoutConfirmOpen && (
            <DialogContent forceMount className="bg-black/80 border-red-500 text-red-400 max-w-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <DialogHeader>
                  <DialogTitle className="text-red-500 text-2xl font-mono text-center">
                    {t("logoutConfirm.title")}
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-4 text-center text-red-400/80 font-mono">
                  {t("logoutConfirm.message")}
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsLogoutConfirmOpen(false)}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20 font-mono"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={confirmLogout}
                    className="bg-red-800 hover:bg-red-700 text-white font-mono"
                  >
                    {t("logout")}
                  </Button>
                </div>
              </motion.div>
            </DialogContent>
          )}
        </AnimatePresence>
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
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
        @keyframes glow {
          from {
            text-shadow: 0 0 10px rgba(239, 68, 68, 0.7), 0 0 15px rgba(0, 0, 0, 0.5);
          }
          to {
            text-shadow: 0 0 20px rgba(239, 68, 68, 1), 0 0 25px rgba(0, 0, 0, 0.7);
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(26, 0, 0, 0.8);
          border-left: 2px solid rgba(255, 0, 0, 0.3);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b0000, #ff0000);
          border-radius: 4px;
        }
        .toast {
          background: #1a0000 !important;
          color: #ff4444 !important;
          border: 1px solid #ff0000 !important;
          font-size: 0.875rem;
          padding: 0.5rem 1rem;
        }
      `}</style>
    </div>
  );
}
