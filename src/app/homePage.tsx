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
import { Gamepad2, Users, Play, Hash, Zap, Skull, Bone, RefreshCw, HelpCircle, RotateCw, LogOut, Menu, Globe, User, X, BookOpen, ArrowLeft, ArrowRight, Camera } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { mysupa, supabase } from "@/lib/supabase";
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
import { preloadGlobalAssets } from "@/lib/preloadAssets";
import LoadingScreen from "@/components/LoadingScreen";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dynamically import the QR Scanner
const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
  { ssr: false }
);

interface BloodDrip {
  id: number;
  left: number;
  speed: number;
  delay: number;
  opacity: number;
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();
  const [gameCode, setGameCode] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [dripCount, setDripCount] = useState(8); // server fallback
  const [iconCount, setIconCount] = useState(5); // server fallback
  const [openHowToPlay, setOpenHowToPlay] = useState(false);
  const [showTooltipOnce, setShowTooltipOnce] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<"join">("join");

  // State untuk debug mode
  const [debugMode, setDebugMode] = useState(false);
  const [massJoinInProgress, setMassJoinInProgress] = useState(false);
  const [massJoinStatus, setMassJoinStatus] = useState("");
  const [joinCount, setJoinCount] = useState(0);


  const atmosphereText = t("atmosphereText");

  useEffect(() => {
    preloadGlobalAssets();
  }, []);

  const bloodDrips = useMemo(() => {
    if (!isClient) return [];
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      speed: 2 + Math.random() * 1.5,
      delay: Math.random() * 5,
      opacity: 0.7 + Math.random() * 0.3,
    }));
  }, [isClient]);

  const generateRandomNickname = useCallback((): string => {
    const prefixes = ["Salsa", "Zombi", "Vampir", "Downey", "Robert", "Windah", "Neko", "Shadow", "Ghost", "Pixel", "Nova"];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNumber = Math.floor(Math.random() * 10000);
    return `${randomPrefix}${randomNumber}`;
  }, []);

  const handleGameCodeChange = useCallback(((value: string) => {
    let processedCode = value;
    if (value.includes("http") && value.includes("?code=")) {
      try {
        const url = new URL(value);
        const codeFromUrl = url.searchParams.get("code");
        if (codeFromUrl) {
          processedCode = codeFromUrl;
        }
      } catch (error) {
        console.warn("Invalid URL, ignoring.");
        return;
      }
    }
    setGameCode(processedCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  }), []);

  const handleNicknameChange = useCallback(((value: string) => {
    setNickname(value.slice(0, 20));
  }), []);

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    if (typeof window !== "undefined") localStorage.setItem("language", value);
    setIsMenuOpen(false);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.warn);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.warn);
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const codeFromUrl = localStorage.getItem("roomCode");
    if (codeFromUrl) {
      handleGameCodeChange(codeFromUrl);
    }
  }, [searchParams, handleGameCodeChange]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    localStorage.removeItem("nickname");
    let defaultNick = generateRandomNickname();
    if (profile?.fullname) defaultNick = profile.fullname;
    else if (profile?.username) defaultNick = profile.username;
    else if (user?.email) defaultNick = user.email.split('@')[0];
    setNickname(defaultNick);
    localStorage.setItem("nickname", defaultNick);
  }, [user, profile, authLoading, generateRandomNickname]);

  const handleHostGame = useCallback(() => {
    setIsCreating(true);
    router.push("/host");
  }, [router]);

  const handleJoinGame = useCallback(async () => {
  if (isJoining || !gameCode || !nickname.trim()) {
    toast.error("Kode game dan nickname harus diisi!");
    return;
  }

  setIsJoining(true);
  setErrorMessage(null);

  try {
    // 1. Cari session berdasarkan game_pin
    const { data: session, error: sessionError } = await mysupa
      .from("sessions")
      .select("id, status, game_pin, host_id, question_limit, total_time_minutes")
      .eq("game_pin", gameCode.toUpperCase())
      .single();

    if (sessionError || !session) {
      toast.error(t("roomNotFound") || "Kode game tidak ditemukan atau sudah expired!");
      setIsJoining(false);
      return;
    }

    if (session.status !== "waiting") {
      toast.error(t("gameAlreadyStarted") || "Game sudah dimulai atau selesai!");
      setIsJoining(false);
      return;
    }

    // 2. Cek apakah user sudah join sebelumnya (opsional, cegah duplikat)
    const { data: existingParticipant } = await mysupa
      .from("participants")
      .select("id")
      .eq("session_id", session.id)
      .eq("nickname", nickname.trim())
      .maybeSingle();

    if (existingParticipant) {
      toast.error(t("nicknameTaken") || "Nickname sudah digunakan di room ini!");
      setIsJoining(false);
      return;
    }

    // 3. Pilih karakter random kalau belum ada di localStorage
    const savedChar = localStorage.getItem("selectedCharacter");
    const characterOptions = [
      "robot1", "robot2", "robot3", "robot4", "robot5",
      "robot6", "robot7", "robot8", "robot9", "robot10"
    ];
    const character_type = savedChar && characterOptions.includes(savedChar)
      ? savedChar
      : characterOptions[Math.floor(Math.random() * characterOptions.length)];

    // 4. Insert participant baru
    const { data: newParticipant, error: insertError } = await mysupa
      .from("participants")
      .insert({
        session_id: session.id,
        nickname: nickname.trim(),
        character_type,
        is_host: false,
        user_id: profile?.id || null,
        score: 0,
        correct_answers: 0,
        is_alive: true,
        position_x: 0,
        position_y: 0,
        power_ups: 0,
        health: {
          max: 100,
          current: 100,
          speed: 1,
          countdown: 0,
          last_answer_time: null,
          last_attack_time: null,
          is_being_attacked: false
        },
        answers: []
      })
      .select()
      .single();

    if (insertError || !newParticipant) {
      console.error("Insert participant error:", insertError);
      toast.error(t("joinFailed") || "Gagal masuk ke room. Coba lagi!");
      setIsJoining(false);
      return;
    }

    // 5. Simpan data penting ke localStorage supaya player page bisa baca
    localStorage.setItem("playerId", newParticipant.id);
    localStorage.setItem("sessionId", session.id);
    localStorage.setItem("gamePin", session.game_pin);
    localStorage.setItem("nickname", nickname.trim());
    localStorage.setItem("selectedCharacter", character_type);

    toast.success(t("joinSuccess") || `Berhasil masuk sebagai ${nickname}!`);
    localStorage.removeItem("roomCode")

    // 6. Pindah ke waiting room player
    router.push(`/player/${gameCode}/lobby`);

  } catch (err) {
    console.error("Unexpected error:", err);
    toast.error("Terjadi kesalahan. Coba lagi nanti.");
  } finally {
    setIsJoining(false);
  }
}, [gameCode, nickname, user, router, t, isJoining]);

  // --- QR SCANNER HANDLERS ---
  const handleScan = (result: any) => {
    if (result) {
      handleGameCodeChange(result.data);
      setIsScannerOpen(false);
      toast.success(t("qrCodeScanned") || "QR Code Scanned!");
    }
  };

  const handleError = (error: any) => {
    console.error("QR Scanner Error:", error);
    toast.error(t("qrScannerError") || "QR Scanner Error.");
  };

  // Logout handler
  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const confirmLogout = async () => {
    setIsLogoutConfirmOpen(false);
    const { error } = await supabase.auth.signOut();
    localStorage.clear()
    if (error) {
      toast.error(t("logoutFailed"));
      console.error("Error logging out:", error);
    } else {
      toast.success(t("logoutSuccess"));
      router.push("/login");
    }
  };

  // Handler untuk hamburger menu
  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleHowToPlayFromMenu = () => {
    setOpenHowToPlay(true);
    setIsMenuOpen(false);
  };


  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      {(isCreating || isJoining || !profile) && <LoadingScreen children={undefined} />}
      {isClient && bloodDrips.map((drip) => (
        <motion.div key={drip.id} initial={{ y: -100 }} animate={{ y: "100vh" }} transition={{ duration: drip.speed, delay: drip.delay, ease: "linear", repeat: Infinity }} className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50" style={{ left: `${drip.left}%`, opacity: drip.opacity }} />
      ))}

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        {/* Hamburger Menu Button - Adapted from reference */}
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05 }}
          onClick={handleMenuToggle}
          className="absolute top-4 right-4 z-40 p-3 bg-black/60 border-2 border-red-500/50 hover:border-red-500 text-red-300 hover:bg-red-500/20 rounded-lg shadow-lg shadow-red-500/30 min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </motion.button>

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
                    <DialogTitle className="text-red-500 text-2xl text-center font-mono">{t("howToPlay")}</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="join" className="mt-4">
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
                  </Tabs>
                </motion.div>
              </DialogContent>
            )}
          </AnimatePresence>
        </Dialog>

        {/* Hamburger Menu Dropdown - Adapted from reference */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="absolute top-20 right-4 z-30 w-64 bg-black/60 border-4 border-red-500/50 rounded-lg p-4 shadow-xl shadow-red-500/30 backdrop-blur-sm max-h-[70vh] overflow-y-auto custom-scrollbar"
            >
              <div className="space-y-4">
                {/* Profile Section - Enhanced with useAuth */}
                <div className="flex items-center gap-3 p-3 bg-black/80 border border-red-500/30 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-900 to-black flex items-center justify-center overflow-hidden">
                    {authLoading ? (
                      <div className="w-full h-full text-red-400 flex items-center justify-center">...</div>
                    ) : profile?.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt="Profile"
                        width={48}
                        height={48}
                        className="w-full h-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-xl font-bold text-red-400">
                        {profile?.fullname?.charAt(0)?.toUpperCase() ||
                          profile?.username?.charAt(0)?.toUpperCase() ||
                          user?.email?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold font-mono text-red-300 truncate">
                      {profile?.fullname || profile?.username || user?.email?.split('@')[0] || t("user")}
                    </p>
                  </div>
                </div>

                {/* Fullscreen Button - Placeholder */}
                <button
                  onClick={handleToggleFullscreen}
                  className="w-full p-2 bg-black/60 border-2 border-red-500/50 hover:border-red-500 text-red-300 hover:bg-red-500/20 rounded text-center"
                  aria-label="Toggle Fullscreen"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-mono text-red-300">
                      {isFullscreen ? t("exitFullscreen") || "Exit Fullscreen" : t("fullscreen") || "Fullscreen"}
                    </span>
                  </div>
                </button>

                {/* How to Play Button */}
                <button
                  onClick={handleHowToPlayFromMenu}
                  className="w-full p-2 bg-black/60 border-2 border-red-500/50 hover:border-red-500 text-red-300 hover:bg-red-500/20 rounded text-center"
                  aria-label="How to Play"
                >
                  <div className="flex items-center justify-center gap-2">

                    <span className="text-sm font-mono text-red-300">{t("howToPlay")}</span>
                  </div>
                </button>

                {/* Language Button */}
                <button
                  onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                  className="w-full p-2 bg-black/60 border-2 border-red-500/50 hover:border-red-500 text-red-300 hover:bg-red-500/20 rounded text-center font-mono"
                  aria-label="Language"
                >
                  <div className="flex items-center justify-center gap-2">

                    <span className="text-sm text-red-300">{t("selectLanguage")}</span>
                  </div>
                </button>

                {/* Language Submenu */}
                <AnimatePresence>
                  {isLangMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-2"
                    >
                      {[
                        { value: "en", label: "English", code: "EN" },
                        { value: "id", label: "Indonesia", code: "ID" },
                        { value: "de", label: "Deutsch", code: "DE" },
                        { value: "fr", label: "Français", code: "FR" },
                        { value: "ja", label: "日本語", code: "JA" },
                        { value: "es", label: "Español", code: "ES" },
                      ].map((lang) => (
                        <Button
                          key={lang.value}
                          variant={i18n.language === lang.value ? "secondary" : "ghost"}
                          className="w-full justify-start text-red-300 hover:bg-red-500/15 hover:text-red-200 text-left py-2 px-3 rounded border border-red-500/10 bg-red-500/5 data-[state=active]:bg-red-500/20"
                          onClick={() => handleLanguageChange(lang.value)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-red-500/20 border border-red-500/40 rounded flex items-center justify-center text-xs font-bold text-red-300">
                              {lang.code}
                            </span>
                            <span className="flex-1">{lang.label}</span>
                          </div>
                        </Button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="w-full p-2 bg-black/60 border-2 border-red-500/50 hover:border-red-500 text-red-300 hover:bg-red-500/20 rounded text-center"
                  aria-label="Logout"
                >
                  <div className="flex items-center justify-center gap-2">
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm font-mono text-red-300">{t("logout")}</span>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center py-8"
          >
            <Image
              src="/logo/quizrushlogo.png"
              alt="QuizRush Logo"
              width={140}   // turunin sedikit biar proporsional
              height={35}   // sesuaikan tinggi
              className="mx-auto w-48 md:w-64 lg:w-80 h-auto"   // ini yang paling berpengaruh
              unoptimized
              onClick={() => router.push("/")}
            />
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
          <div className="w-full max-w-4xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl w-full px-4">
              <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.8 }} whileHover={{ scale: 1.02 }}>
                <Card className="bg-black/40 border-red-900/50 hover:border-red-500 transition-all duration-300 h-full shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                  <CardHeader className="text-center pb-6">
                    <motion.div className="w-20 h-20 bg-gradient-to-br from-red-900 to-black border-2 border-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6" whileHover={{ rotate: 5 }}>
                      <Users className="w-10 h-10 text-red-400" />
                    </motion.div>
                    <CardTitle className="text-3xl font-bold text-red-400 font-mono">{t("hostGame")}</CardTitle>
                    <CardDescription className="text-red-400/80 text-lg font-mono">{t("hostDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleHostGame} disabled={isCreating || authLoading} className="w-full bg-gradient-to-r from-red-900 to-red-700 text-white font-mono text-lg py-4 rounded-xl border-2 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                      <Play className="w-5 h-5 mr-2" />
                      {isCreating ? t("creatingRoom") : t("createRoomButton")}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.8 }} whileHover={{ scale: 1.02 }}>
                <Card className="bg-black/40 border-red-900/50 hover:border-red-500 transition-all duration-300 h-full shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                  <CardHeader className="text-center pb-3">
                    <motion.div className="w-20 h-20 bg-gradient-to-br from-red-900 to-black border-2 border-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6" whileHover={{ rotate: -3 }}>
                      <Play className="w-10 h-10 text-red-400" />
                    </motion.div>
                    <CardTitle className="text-3xl font-bold text-red-400 font-mono">{t("joinGame")}</CardTitle>
                    <CardDescription className="text-red-400/80 text-lg font-mono">{t("joinDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Input placeholder={t("gameCodePlaceholder")} value={gameCode} onChange={(e) => handleGameCodeChange(e.target.value)} className="bg-black/50 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-center text-xl font-mono h-12 rounded-xl flex-1" />
                        <Button variant="outline" size="icon" onClick={() => setIsScannerOpen(true)} className="border-red-500/50 text-red-400 hover:bg-red-500/20 h-12 w-12">
                          <Camera className="h-5 w-5" />
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input placeholder={t("nicknamePlaceholder")} value={nickname} onChange={(e) => handleNicknameChange(e.target.value)} className="bg-black/50 border-red-500/50 text-red-400 placeholder:text-red-400/50 text-center text-xl font-mono h-12 rounded-xl flex-1" maxLength={20} />
                        <Button variant="outline" size="icon" onClick={() => setNickname(generateRandomNickname())} className="border-red-500/50 text-red-400 hover:bg-red-500/20 h-12 w-12">
                          <RefreshCw className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    <Button onClick={handleJoinGame} disabled={!gameCode || !nickname || isJoining || authLoading} className="w-full bg-gradient-to-r from-red-900 to-red-700 text-white font-mono text-lg py-4 rounded-xl border-2 border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                      {isJoining ? t("joining") : t("joinButton")}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>

        <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
          <DialogContent className="bg-black/90 border-red-500/50 max-w-md mx-auto p-0">
            <DialogHeader className="p-4 border-b border-red-500/20">
              <DialogTitle className="text-red-500 text-center text-lg font-mono">
                Scan QR Code Room
              </DialogTitle>
            </DialogHeader>
            <div className="p-4 flex flex-col items-center space-y-4">
              <div className="relative w-full max-w-xs rounded-lg overflow-hidden border border-red-500/30">
                <Scanner
                  onScan={handleScan}
                  onError={handleError}
                  constraints={{ facingMode: "environment" }}
                />
              </div>
              <button type="button" onClick={() => setIsScannerOpen(false)} className="text-red-400/70 hover:text-red-400 text-sm transition-colors">
                Batal
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Logout Confirmation Dialog */}
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
      </div>
    </div>
  )
}