"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skull, Bone, HeartPulse, Ghost, Zap, Clock, ArrowRight, Settings, List, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useHostGuard } from "@/lib/host-guard";
import Link from "next/link";
import toast from "react-hot-toast";
import LoadingScreen from "@/components/LoadingScreen"; // ← Pastikan versi all-in-one

const validChaserTypes = ["zombie", "monster1", "monster2", "monster3", "darknight"] as const;
type ChaserType = typeof validChaserTypes[number];

interface DifficultyOption {
  value: "easy" | "medium" | "hard";
  zombieAttackCountdown: number;
  inactivityPenalty: number;
  icon: React.ReactNode;
}

interface GameRoom {
  id: string;
  room_code: string;
  title: string | null;
  status: "waiting" | "playing" | "finished";
  max_players: number;
  duration: number | null;
  question_count: number | null;
  chaser_type: ChaserType;
  difficulty_level: DifficultyLevel;
  quiz_id: string | null;
  embedded_questions: any[];
}

const validateChaserType = (type: string): ChaserType =>
  validChaserTypes.includes(type as ChaserType) ? (type as ChaserType) : "zombie";

const validateDifficultyLevel = (level: string): DifficultyLevel =>
  ["easy", "medium", "hard"].includes(level) ? (level as DifficultyLevel) : "medium";

const playSound = (src: string, volume: number = 0.3) => {
  const audio = new Audio(src);
  audio.volume = volume;
  audio.play().catch((e) => console.log("Sound play prevented:", e));
  return audio;
};

type DifficultyLevel = "easy" | "medium" | "hard";

export default function CharacterSelectPage() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;
  const [isLoading, setIsLoading] = useState(true); // ← Kontrol data ready
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [gameDuration, setGameDuration] = useState<number>(10);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [userSetQuestionCount, setUserSetQuestionCount] = useState(false);
  const [chaserType, setChaserType] = useState<ChaserType>("zombie");
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>("medium");
  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([]);
  const [currentChaserIndex, setCurrentChaserIndex] = useState(0);

  useHostGuard(roomCode);

  const chaserOptions = useMemo(
    () => [
      {
        value: "zombie" as const,
        name: t("chasers.zombie.name"),
        gif: "/character/chaser/zombie.webp",
        alt: t("chasers.zombie.alt"),
        description: t("chasers.zombie.description"),
      },
      {
        value: "monster1" as const,
        name: t("chasers.monster1.name"),
        gif: "/character/chaser/monster1.webp",
        alt: t("chasers.monster1.alt"),
        description: t("chasers.monster1.description"),
      },
      {
        value: "monster2" as const,
        name: t("chasers.monster2.name"),
        gif: "/character/chaser/monster2.webp",
        alt: t("chasers.monster2.alt"),
        description: t("chasers.monster2.description"),
      },
      {
        value: "monster3" as const,
        name: t("chasers.monster3.name"),
        gif: "/character/chaser/monster3.webp",
        alt: t("chasers.monster3.alt"),
        description: t("chasers.monster3.description"),
      },
      {
        value: "darknight" as const,
        name: t("chasers.darknight.name"),
        gif: "/character/chaser/darknight.webp",
        alt: t("chasers.darknight.alt"),
        description: t("chasers.darknight.description"),
      },
    ],
    [t]
  );

  const difficultyOptions: DifficultyOption[] = useMemo(
    () => [
      { value: "easy", zombieAttackCountdown: 30, inactivityPenalty: 25, icon: null },
      { value: "medium", zombieAttackCountdown: 20, inactivityPenalty: 10, icon: null },
      { value: "hard", zombieAttackCountdown: 10, inactivityPenalty: 5, icon: null },
    ],
    []
  );

  const isFormValid = gameDuration >= 1 && gameDuration <= 30 && questionCount <= totalQuestions;

  const questionOptions = useMemo(() => {
    const opts: number[] = [];
    for (let i = 5; i <= totalQuestions; i += 5) {
      opts.push(i);
    }
    return opts;
  }, [totalQuestions]);

  // ==== HANDLERS (SEMUA TETAP SAMA) ====
  const handleDurationChange = (delta: number) => {
    const newValue = Math.max(5, Math.min(30, gameDuration + delta));
    if (newValue < 1 || newValue > 30) {
      setDurationError(t("durationError"));
      return;
    }
    setDurationError(null);
    setGameDuration(newValue);
  };

  const handleQuestionCountChange = (delta: number) => {
    const newValue = Math.max(5, Math.min(totalQuestions, questionCount + delta));
    setQuestionCount(newValue);
    setUserSetQuestionCount(true);
  };

  const handleDifficultyChange = (value: string) => {
    setDifficultyLevel(value as DifficultyLevel);
  };

  const handleChaserSelect = (chaser: typeof chaserOptions[number], index: number) => {
    setChaserType(chaser.value);
    setCurrentChaserIndex(index);
  };

  const nextChaser = () => {
    const newIndex = (currentChaserIndex + 1) % chaserOptions.length;
    setCurrentChaserIndex(newIndex);
    setChaserType(chaserOptions[newIndex].value);
  };

  const prevChaser = () => {
    const newIndex = (currentChaserIndex - 1 + chaserOptions.length) % chaserOptions.length;
    setCurrentChaserIndex(newIndex);
    setChaserType(chaserOptions[newIndex].value);
  };

  const prevIndex = useMemo(() => (currentChaserIndex - 1 + chaserOptions.length) % chaserOptions.length, [currentChaserIndex]);
  const nextIndex = useMemo(() => (currentChaserIndex + 1) % chaserOptions.length, [currentChaserIndex]);
  const prevChaserOpt = useMemo(() => chaserOptions[prevIndex], [prevIndex, chaserOptions]);
  const nextChaserOpt = useMemo(() => chaserOptions[nextIndex], [nextIndex, chaserOptions]);
  const currentChaser = chaserOptions[currentChaserIndex];

  // ==== MAIN USEEFFECT - DATA FETCHING ====
  useEffect(() => {
    if (!roomCode || typeof roomCode !== "string") {
      toast.error(t("errorMessages.invalidRoomCode"));
      router.push("/");
      return;
    }

    const fetchRoom = async () => {
      try {
        const { data, error } = await supabase
          .from("game_rooms")
          .select(`*, embedded_questions`)
          .eq("room_code", roomCode)
          .single();

        if (error || !data) {
          console.error(t("errorMessages.roomNotFoundLog"), error?.message);
          router.push("/");
          return;
        }

        if (!data.quiz_id) {
          console.error(t("errorMessages.quizIdNotFoundLog"));
          toast.error(t("errorMessages.quizIdNotFound"));
          router.push("/");
          return;
        }

        const fetchedChaserType = validateChaserType(data.chaser_type);
        const fetchedDifficultyLevel = validateDifficultyLevel(data.difficulty_level);
        setRoom({ 
          ...data, 
          chaser_type: fetchedChaserType, 
          difficulty_level: fetchedDifficultyLevel,
          embedded_questions: data.embedded_questions || []
        });
        setGameDuration(data.duration ? data.duration / 60 : 10);
        setQuestionCount(data.question_count ?? 10);
        setChaserType(fetchedChaserType);
        setDifficultyLevel(fetchedDifficultyLevel);

        let total = data.embedded_questions ? data.embedded_questions.length : 0;
        if (total === 0) {
          const { data: quizData, error: quizError } = await supabase
            .from("quizzes")
            .select("questions")
            .eq("id", data.quiz_id)
            .single();
          if (!quizError && quizData && quizData.questions) {
            total = quizData.questions.length;
          } else {
            total = 10;
            console.warn("Could not fetch quiz questions, using default 10");
          }
        }
        setTotalQuestions(total);
        if (!userSetQuestionCount) {
          if (data.question_count) {
            setQuestionCount(data.question_count);
          } else {
            setQuestionCount(total <= 10 ? total : 10);
          }
        }
      } catch (error) {
        console.error(t("errorMessages.fetchRoomFailedLog"), error);
        toast.error(t("errorMessages.fetchRoomFailed"));
        router.push("/");
      } finally {
        setIsLoading(false); // ← INI YANG BARU: kasih tahu LoadingScreen data sudah ready
      }
    };

    fetchRoom();
  }, [roomCode, router, t]);

  // ==== EFFECTS LAINNYA (tetap sama) ====
  useEffect(() => {
    const generateBlood = () => {
      const newBlood = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        speed: 2 + Math.random() * 1.5,
        delay: Math.random() * 5,
      }));
      setBloodDrips(newBlood);
    };
    generateBlood();
  }, []);

  useEffect(() => {
    const flickerInterval = setInterval(
      () => setFlickerText((prev) => !prev),
      100 + Math.random() * 150,
    );
    return () => clearInterval(flickerInterval);
  }, []);

  const saveSettings = async () => {
    if (!room || !isFormValid) return;
    setIsSaving(true);
    try {
      const validatedChaserType = validateChaserType(chaserType);
      const validatedDifficultyLevel = validateDifficultyLevel(difficultyLevel);
      const durationInSeconds = gameDuration * 60;

      const updatePromise = supabase
        .from("game_rooms")
        .update({
          duration: durationInSeconds,
          question_count: questionCount,
          chaser_type: validatedChaserType,
          difficulty_level: validatedDifficultyLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id);

      const minDelayPromise = new Promise(resolve => setTimeout(resolve, 500));

      const [{ error }] = await Promise.all([updatePromise, minDelayPromise]);

      if (error) {
        throw error;
      }
      router.push(`/host/${roomCode}/lobby`);
    } catch (error) {
      console.error(t("errorMessages.saveSettingsFailedLog"), error);
      toast.error(t("errorMessages.saveSettingsFailed"));
      setIsSaving(false);
    }
  };

  if (isSaving) {
    return <LoadingScreen isReady={false} children={undefined} />;
  }

  // ==== RENDER DENGAN LOADINGSCREEN ====
  return (
    <LoadingScreen minDuration={500} isReady={!isLoading && !!room}>
      {/* SELURUH KONTEN HALAMAN */}
      <div className="min-h-screen relative overflow-hidden select-none bg-black">
        {/* Logo & Header */}
        <div className="absolute top-4 left-4 z-20 hidden md:block">
    
              <Image 
                  src="/logo/quizrushlogo.png" 
                  alt="QuizRush Logo" 
                  width={140}   // turunin sedikit biar proporsional
                  height={35}   // sesuaikan tinggi
                  className="w-32 md:w-40 lg:w-48 h-auto"   // ini yang paling berpengaruh
                  unoptimized 
                />
        
        </div>
        <div className="absolute top-4 right-4 z-20 hidden md:block">
          <img src={`/logo/gameforsmartlogo-horror.png`} alt="Game for Smart Logo" className="w-40 md:w-48 lg:w-56 h-auto" />
        </div>

        {/* Background & Effects */}
        <div className="absolute inset-0 z-0" style={{ backgroundImage: "url('/background/10.gif')", backgroundSize: "cover", backgroundPosition: "center", transform: "rotate(180deg) scaleX(-1)" }}></div>
        <audio src="/musics/background-music-room.mp3" autoPlay loop />
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5">
          <div className="absolute inset-0 opacity-20">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="absolute w-64 h-64 bg-red-900 rounded-full mix-blend-multiply blur-xl" style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: 0.3 + Math.random() * 0.4,
              }} />
            ))}
          </div>
        </div>

        {/* Blood Drips */}
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

        {/* Floating Icons */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="absolute text-red-900/20 animate-float" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              fontSize: `${2 + Math.random() * 3}rem`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${15 + Math.random() * 20}s`,
            }}>
              {Math.random() > 0.5 ? <Skull /> : <Bone />}
            </div>
          ))}
        </div>

        {/* Scratch Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJzY3JhdGNoZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48cGF0aCBkPSJNMCAwTDUwMCA1MDAiIHN0cm9rZT0icmdiYSgyNTUsMCwwLDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48cGF0aCBkPSJNMCAxMDBLNTAwIDYwMCIgc3Ryb2tlPSJyZ2JhKDI1NSwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDIwMEw1MDAgNzAwIiBzdHJva2U9InJnYmEoMjU1LDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NjcmF0Y2hlcykiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] opacity-20" />

        {/* MAIN CONTENT */}
        <div className="relative z-10 mx-auto p-4 max-w-4xl">
          <motion.header initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }} className="flex flex-col gap-1 mb-6">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }} className="flex justify-center items-center text-center mb-3 mt-10">
              <h1 className={`text-4xl md:text-6xl font-bold font-mono tracking-wider transition-all duration-150 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse ${flickerText ? "opacity-70" : "opacity-100"}`} style={{ textShadow: "0 0 10px rgba(239,68,68,0.7)" }}>
                {t("settingsTitle")}
              </h1>
            </motion.div>
          </motion.header>

          {/* Chaser Carousel */}
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center gap-4 md:gap-6">
              <motion.button whileTap={{ scale: 0.9 }} onClick={prevChaser} className="hidden md:flex w-12 h-12 md:w-16 md:h-16 p-3 md:p-4 text-red-300 transition-colors flex-shrink-0 border-2 border-red-500/50 rounded-lg bg-black/40 flex items-center justify-center">
                <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
              </motion.button>

              <div role="button" tabIndex={0} onClick={() => handleChaserSelect(prevChaserOpt, prevIndex)} onKeyDown={(e) => e.key === "Enter" && handleChaserSelect(prevChaserOpt, prevIndex)} className="relative w-20 h-20 md:w-32 md:h-32 rounded-full cursor-pointer transition-all duration-300 overflow-hidden bg-black/40">
                <Image src={prevChaserOpt.gif} alt={prevChaserOpt.alt || `Chaser ${prevChaserOpt.name}`} fill className="object-cover" unoptimized style={{ imageRendering: "pixelated" }} />
              </div>

              <div role="button" tabIndex={0} onClick={() => handleChaserSelect(currentChaser, currentChaserIndex)} onKeyDown={(e) => e.key === "Enter" && handleChaserSelect(currentChaser, currentChaserIndex)} className="relative w-40 h-40 md:w-64 md:h-64 rounded-full cursor-pointer transition-all duration-300 overflow-hidden bg-black/40">
                <Image src={currentChaser.gif} alt={currentChaser.alt || `Chaser ${currentChaser.name}`} fill className="object-cover" unoptimized style={{ imageRendering: "pixelated" }} />
              </div>

              <div role="button" tabIndex={0} onClick={() => handleChaserSelect(nextChaserOpt, nextIndex)} onKeyDown={(e) => e.key === "Enter" && handleChaserSelect(nextChaserOpt, nextIndex)} className="relative w-20 h-20 md:w-32 md:h-32 rounded-full cursor-pointer transition-all duration-300 overflow-hidden bg-black/40 hover:bg-red-900/20 hover:shadow-[0_0_15px_rgba(255,0,0,0.6)]">
                <Image src={nextChaserOpt.gif} alt={nextChaserOpt.alt || `Chaser ${nextChaserOpt.name}`} fill className="object-cover" unoptimized style={{ imageRendering: "pixelated" }} />
              </div>

              <motion.button whileTap={{ scale: 0.9 }} onClick={nextChaser} className="hidden md:flex w-12 h-12 md:w-16 md:h-16 p-3 md:p-4 text-red-300 transition-colors flex-shrink-0 border-2 border-red-500/50 rounded-lg bg-black/40 flex items-center justify-center">
                <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
              </motion.button>
            </div>

            <div className="flex flex-col items-center mt-4">
              <div className="flex items-center justify-center gap-4">
                <motion.button whileTap={{ scale: 0.9 }} onClick={prevChaser} className="w-8 h-8 p-2 text-red-300 transition-colors flex-shrink-0 border-2 border-red-500/50 rounded-lg bg-black/40 flex items-center justify-center md:hidden">
                  <ChevronLeft className="w-6 h-6" />
                </motion.button>
                <motion.p key={currentChaser.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 font-mono text-center font-bold text-sm md:text-base">
                  {currentChaser.name}
                </motion.p>
                <motion.button whileTap={{ scale: 0.9 }} onClick={nextChaser} className="w-8 h-8 p-2 text-red-300 transition-colors flex-shrink-0 border-2 border-red-500/50 rounded-lg bg-black/40 flex items-center justify-center md:hidden">
                  <ChevronRight className="w-6 h-6" />
                </motion.button>
              </div>
              <span className="text-red-400 font-mono text-xs mt-1">{`${currentChaserIndex + 1}/${chaserOptions.length}`}</span>
            </div>
          </motion.div>

          {/* Game Settings */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="max-w-4xl mx-auto space-y-6 mt-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Duration */}
              <div className="p-3 bg-red-900/20 rounded border border-red-900/30">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-red-300 font-mono text-xs flex items-center">{t("gameDurationLabel")}</span>
                </div>
                <div className="flex items-center justify-center space-x-4">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDurationChange(-5)} className="w-8 h-8 bg-red-800/50 rounded text-red-200 border border-red-600/50 flex items-center justify-center text-sm">
                    <Minus className="w-3 h-3" />
                  </motion.button>
                  <span className="text-red-400 font-mono text-xs min-w-[2rem] text-center">{gameDuration} {t("minutes")}</span>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDurationChange(5)} className="w-8 h-8 bg-red-800/50 rounded text-red-200 border border-red-600/50 flex items-center justify-center text-sm">
                    <Plus className="w-3 h-3" />
                  </motion.button>
                </div>
                {durationError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-xs mt-1 animate-pulse font-mono text-center">
                    {durationError}
                  </motion.p>
                )}
              </div>

              {/* Questions */}
              <div className="p-3 bg-red-900/20 rounded border border-red-900/30">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-red-300 font-mono text-xs flex items-center">{t("questionCountLabel")}</span>
                </div>
                <div className="flex items-center justify-center space-x-4">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleQuestionCountChange(-5)} className="w-8 h-8 bg-red-800/50 rounded text-red-200 border border-red-600/50 flex items-center justify-center text-sm" disabled={questionCount <= 5}>
                    <Minus className="w-3 h-3" />
                  </motion.button>
                  <span className="text-red-400 font-mono text-xs min-w-[2rem] text-center">
                    {questionCount} {t("questions")} 
                  </span>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleQuestionCountChange(5)} className="w-8 h-8 bg-red-800/50 rounded text-red-200 border border-red-600/50 flex items-center justify-center text-sm" disabled={questionCount >= totalQuestions}>
                    <Plus className="w-3 h-3" />
                  </motion.button>
                </div>
                {questionCount > totalQuestions && (
                  <p className="text-red-500 text-xs mt-1 animate-pulse font-mono text-center">{t("questionError")}</p>
                )}
              </div>

              {/* Difficulty */}
              <div className="p-3 bg-red-900/20 rounded border border-red-900/30">
                <Label className="text-red-300 mb-3 block font-medium text-xs font-mono flex items-center justify-center">{t("difficultyLevelLabel")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {difficultyOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDifficultyChange(option.value)}
                      className={`p-2 rounded-lg cursor-pointer transition-all duration-200 border font-mono text-xs flex flex-col items-center ${difficultyLevel === option.value
                        ? "bg-red-900/60 border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.6)] text-red-200"
                        : "bg-black/40 border-red-900/50 text-red-400"
                      }`}
                    >
                      {option.icon}
                      <span className="mt-1">{t(`difficulty.${option.value}`)}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
              <Button
                onClick={saveSettings}
                disabled={isSaving || !isFormValid}
                className={`w-full bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white rounded-lg font-mono text-sm py-3 shadow-lg shadow-red-900/30 transition-all ${!isFormValid || isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isSaving ? t("continuing") : t("continue")}
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Styles */}
        <style jsx global>{`
          @keyframes fall { to { transform: translateY(100vh); } }
          @keyframes float { 0%,100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-20px) rotate(180deg); } }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(10, 0, 0, 0.8); border-left: 1px solid rgba(255, 0, 0, 0.2); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #600000, #ff0000); border-radius: 2px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: linear-gradient(to bottom, #800000, #ff3030); }
          .animate-float { animation: float 20s infinite ease-in-out; }
        `}</style>
      </div>
    </LoadingScreen>
  );
}