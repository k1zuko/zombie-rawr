"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skull, Bone, HeartPulse, Ghost, Zap, Clock, ArrowRight, Settings, List, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { supabase, mysupa } from "@/lib/supabase";
import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useHostGuard } from "@/lib/host-guard";
import Link from "next/link";
import toast from "react-hot-toast";
import { shuffleArray } from "@/utils/gameHelpers";
import LoadingScreen from "@/components/LoadingScreen";

const validChaserTypes = ["zombie", "monster1", "monster2", "monster3", "darknight"] as const;
type ChaserType = typeof validChaserTypes[number];
type DifficultyLevel = "easy" | "medium" | "hard";

interface GameSession {
  id: string;
  quiz_id: string;
  host_id: string;
  game_pin: string;
  status: string;
  total_time_minutes: number;
  question_limit: number;
  difficulty: DifficultyLevel;
  chaser_type: ChaserType;
  quiz_detail: any;
}

const validateChaserType = (type: any): ChaserType =>
  validChaserTypes.includes(type as ChaserType) ? (type as ChaserType) : "zombie";

const validateDifficultyLevel = (level: any): DifficultyLevel =>
  ["easy", "medium", "hard"].includes(level) ? (level as DifficultyLevel) : "medium";

export default function CharacterSelectPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [sessionData, setSessionData] = useState<GameSession | null>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(10);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [gameDuration, setGameDuration] = useState<number>(10);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [chaserType, setChaserType] = useState<ChaserType>("zombie");
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>("medium");

  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([]);
  const [currentChaserIndex, setCurrentChaserIndex] = useState(0);

  useHostGuard(roomCode);

  const chaserOptions = useMemo(
    () => [
      { value: "zombie" as const, name: t("chasers.zombie.name"), gif: "/character/chaser/zombie.webp", alt: t("chasers.zombie.alt") },
      { value: "monster1" as const, name: t("chasers.monster1.name"), gif: "/character/chaser/monster1.webp", alt: t("chasers.monster1.alt") },
      { value: "monster2" as const, name: t("chasers.monster2.name"), gif: "/character/chaser/monster2.webp", alt: t("chasers.monster2.alt") },
      { value: "monster3" as const, name: t("chasers.monster3.name"), gif: "/character/chaser/monster3.webp", alt: t("chasers.monster3.alt") },
      { value: "darknight" as const, name: t("chasers.darknight.name"), gif: "/character/chaser/darknight.webp", alt: t("chasers.darknight.alt") },
    ],
    [t]
  );

  const difficultyOptions = useMemo(
    () => [
      { value: "easy" as DifficultyLevel, icon: null },
      { value: "medium" as DifficultyLevel, icon: null },
      { value: "hard" as DifficultyLevel, icon: null },
    ],
    []
  );

  useEffect(() => {
    if (!roomCode) {
      toast.error(t("errorMessages.invalidRoomCode"));
      router.push("/");
      return;
    }

    const fetchSessionDetails = async () => {
      setIsLoading(true);

      const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .select("id, quiz_id, host_id, game_pin, total_time_minutes, question_limit, difficulty")
        .eq("game_pin", roomCode)
        .single();

      if (sessionError || !session) {
        console.error("Error fetching game session:", sessionError);
        toast.error(t("errorMessages.roomNotFound"));
        router.push("/host");
        return;
      }

      const difficultyString = session.difficulty || 'zombie:medium';
      const [fetchedChaser, fetchedDifficulty] = difficultyString.split(':');

      const validatedDifficulty = validateDifficultyLevel(fetchedDifficulty);
      const validatedChaser = validateChaserType(fetchedChaser);

      setSessionData(session as GameSession);
      setGameDuration(session.total_time_minutes || 10);
      setQuestionCount(session.question_limit ? parseInt(String(session.question_limit), 10) : 10);
      setDifficultyLevel(validatedDifficulty);
      setChaserType(validatedChaser);
      const initialChaserIndex = chaserOptions.findIndex(c => c.value === validatedChaser);
      setCurrentChaserIndex(initialChaserIndex > -1 ? initialChaserIndex : 0);

      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("questions")
        .eq("id", session.quiz_id)
        .single();

      if (quizError || !quizData) {
        console.error("Error fetching quiz:", quizError);
        toast.error("Failed to load quiz questions.");
        setTotalQuestions(10); // Fallback
      } else {
        setQuiz(quizData);
        const total = quizData.questions?.length || 0;
        setTotalQuestions(total);
        if (session.question_limit > total) {
          setQuestionCount(total);
        }
      }
      setIsLoading(false);
    };

    fetchSessionDetails();
  }, [roomCode, router, t, chaserOptions]);


  const saveSettings = async () => {
    if (!sessionData || !quiz || !isFormValid) return;
    setIsSaving(true);
    toast.loading(t("savingSettings"));

    try {
      // 1. Prepare settings object
      const newDifficultyString = `${chaserType}:${difficultyLevel}`;
      const settings = {
        total_time_minutes: gameDuration,
        question_limit: questionCount,
        difficulty: newDifficultyString,
        current_questions: shuffleArray(quiz.questions).slice(0, questionCount),
      };

      // 2. Update main Supabase (supabase)
      const { error: mainDbError } = await supabase
        .from("game_sessions")
        .update(settings)
        .eq("game_pin", roomCode);

      if (mainDbError) {
        throw new Error(`Main DB Error: ${mainDbError.message}`);
      }

      // 3. Upsert to secondary Supabase (mysupa)
      // This assumes 'mysupa' has a 'sessions' table with a similar structure.
      const { error: secondaryDbError } = await mysupa.from("sessions").upsert({
        id: sessionData.id,
        game_pin: sessionData.game_pin,
        quiz_id: sessionData.quiz_id,
        host_id: sessionData.host_id,
        ...settings,
      }, { onConflict: 'id' });

      if (secondaryDbError) {
        // We can decide if this is a critical error. For now, we'll log it but still proceed.
        console.warn("Could not save settings to secondary DB:", secondaryDbError);
        toast.error("Warning: Secondary DB update failed.");
      }

      toast.dismiss();
      toast.success(t("settingsSaved"));
      router.push(`/host/${roomCode}/lobby`);

    } catch (error: any) {
      console.error(t("errorMessages.saveSettingsFailedLog"), error);
      toast.dismiss();
      toast.error(error.message || t("errorMessages.saveSettingsFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = gameDuration >= 1 && gameDuration <= 30 && questionCount <= totalQuestions;

  const handleDurationChange = (delta: number) => {
    const newValue = Math.max(5, Math.min(30, gameDuration + delta));
    setGameDuration(newValue);
  };

  const handleQuestionCountChange = (delta: number) => {
    const newValue = Math.max(5, Math.min(totalQuestions, questionCount + delta));
    setQuestionCount(newValue);
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

  const currentChaser = chaserOptions[currentChaserIndex];
  const prevChaserOpt = chaserOptions[(currentChaserIndex - 1 + chaserOptions.length) % chaserOptions.length];
  const nextChaserOpt = chaserOptions[(currentChaserIndex + 1) % chaserOptions.length];

  useEffect(() => {
    const generateBlood = () => setBloodDrips(Array.from({ length: 5 }, (_, i) => ({ id: i, left: Math.random() * 100, speed: 2 + Math.random() * 1.5, delay: Math.random() * 5 })));
    generateBlood();
    const flickerInterval = setInterval(() => setFlickerText(prev => !prev), 100 + Math.random() * 150);
    return () => clearInterval(flickerInterval);
  }, []);

  if (isLoading) {
    <LoadingScreen children={undefined} />
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-400 text-xl font-mono text-center p-6 border border-red-900/50 bg-black/60">
        <Skull className="w-12 h-12 mx-auto mb-4 animate-pulse" />
        <p>{t("roomNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden select-none bg-black">
      <div className="absolute inset-0 z-0" style={{ backgroundImage: "url('/background/10.gif')", backgroundSize: "cover", backgroundPosition: "center", transform: "rotate(180deg) scaleX(-1)" }}></div>
      <audio src="/musics/background-music-room.mp3" autoPlay loop />
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-black to-purple-900/5" />

      {bloodDrips.map((drip) => (
        <motion.div key={drip.id} initial={{ y: -100 }} animate={{ y: "100vh" }} transition={{ duration: drip.speed, delay: drip.delay, ease: "linear", repeat: Infinity }}
          className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50" style={{ left: `${drip.left}%`, opacity: 0.6 + Math.random() * 0.2 }} />
      ))}

      <div className="relative z-10 mx-auto p-4 max-w-8xl">
        <div className="hidden md:flex items-center justify-between">
          <Image
            src="/logo/quizrushlogo.png"
            alt="QuizRush Logo"
            width={140}   // turunin sedikit biar proporsional
            height={35}   // sesuaikan tinggi
            className="w-32 md:w-40 lg:w-48 h-auto"   // ini yang paling berpengaruh
            unoptimized
            onClick={() => router.push("/")}
          />
          <img src={`/logo/gameforsmartlogo-horror.png`} alt="Logo" className="w-40 md:w-52 lg:w-64 h-auto" />
        </div>
        <header className="flex flex-col gap-1 mb-6 text-center">
          <h1 className={`text-4xl md:text-6xl font-bold font-mono tracking-wider transition-all duration-150 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse ${flickerText ? "opacity-70" : "opacity-100"}`}
            style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}>
            {t("settingsTitle")}
          </h1>
        </header>

        {/* Chaser Selection */}
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center gap-4 md:gap-6">
            <motion.button whileTap={{ scale: 0.9 }} onClick={prevChaser} className="hidden md:flex items-center justify-center w-16 h-16 text-red-300 border-2 border-red-500/50 rounded-lg bg-black/40"> <ChevronLeft className="w-10 h-10" /> </motion.button>
            <div className="relative w-20 h-20 md:w-32 md:h-32 rounded-full overflow-hidden bg-black/40"> <Image src={prevChaserOpt.gif} alt={prevChaserOpt.alt} fill className="object-cover" unoptimized style={{ imageRendering: "pixelated" }} /> </div>
            <div className="relative w-40 h-40 md:w-64 md:h-64 rounded-full overflow-hidden bg-black/40"> <Image src={currentChaser.gif} alt={currentChaser.alt} fill className="object-cover" unoptimized style={{ imageRendering: "pixelated" }} /> </div>
            <div className="relative w-20 h-20 md:w-32 md:h-32 rounded-full overflow-hidden bg-black/40"> <Image src={nextChaserOpt.gif} alt={nextChaserOpt.alt} fill className="object-cover" unoptimized style={{ imageRendering: "pixelated" }} /> </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={nextChaser} className="hidden md:flex items-center justify-center w-16 h-16 text-red-300 border-2 border-red-500/50 rounded-lg bg-black/40"> <ChevronRight className="w-10 h-10" /> </motion.button>
          </div>
          <div className="flex flex-col items-center mt-4">
            <div className="flex items-center justify-center gap-4">
              <motion.button whileTap={{ scale: 0.9 }} onClick={prevChaser} className="w-8 h-8 p-2 text-red-300 border-2 border-red-500/50 rounded-lg bg-black/40 flex items-center justify-center md:hidden"> <ChevronLeft className="w-6 h-6" /> </motion.button>
              <p className="text-red-400 font-mono text-center font-bold text-sm md:text-base"> {currentChaser.name} </p>
              <motion.button whileTap={{ scale: 0.9 }} onClick={nextChaser} className="w-8 h-8 p-2 text-red-300 border-2 border-red-500/50 rounded-lg bg-black/40 flex items-center justify-center md:hidden"> <ChevronRight className="w-6 h-6" /> </motion.button>
            </div>
            <span className="text-red-400 font-mono text-xs mt-1">{`${currentChaserIndex + 1}/${chaserOptions.length}`}</span>
          </div>
        </motion.div>

        {/* Game Settings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="max-w-4xl mx-auto space-y-6 mt-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Duration */}
            <div className="p-3 bg-red-900/20 rounded border border-red-900/30">
              <Label className="text-red-300 mb-2 block font-medium text-xs font-mono text-center">{t("gameDurationLabel")}</Label>
              <div className="flex items-center justify-center space-x-4">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDurationChange(-5)} className="w-8 h-8 bg-red-800/50 rounded text-red-200 border border-red-600/50 flex items-center justify-center text-sm"> <Minus className="w-3 h-3" /> </motion.button>
                <span className="text-red-400 font-mono text-xs min-w-[2rem] text-center">{gameDuration} {t("minutes")}</span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDurationChange(5)} className="w-8 h-8 bg-red-800/50 rounded text-red-200 border border-red-600/50 flex items-center justify-center text-sm"> <Plus className="w-3 h-3" /> </motion.button>
              </div>
            </div>

            {/* Questions */}
            <div className="p-3 bg-red-900/20 rounded border border-red-900/30">
              <Label className="text-red-300 mb-2 block font-medium text-xs font-mono text-center">{t("questionCountLabel")}</Label>
              <div className="flex items-center justify-center space-x-4">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleQuestionCountChange(-5)} className="w-8 h-8 bg-red-800/50 rounded text-red-200 border border-red-600/50 flex items-center justify-center text-sm" disabled={questionCount <= 5}> <Minus className="w-3 h-3" /> </motion.button>
                <span className="text-red-400 font-mono text-xs min-w-[2rem] text-center"> {questionCount} / {totalQuestions} </span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleQuestionCountChange(5)} className="w-8 h-8 bg-red-800/50 rounded text-red-200 border border-red-600/50 flex items-center justify-center text-sm" disabled={questionCount >= totalQuestions}> <Plus className="w-3 h-3" /> </motion.button>
              </div>
            </div>

            {/* Difficulty */}
            <div className="p-3 bg-red-900/20 rounded border border-red-900/30">
              <Label className="text-red-300 mb-3 block font-medium text-xs font-mono text-center">{t("difficultyLevelLabel")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {difficultyOptions.map((option) => (
                  <motion.button key={option.value} whileTap={{ scale: 0.95 }} onClick={() => setDifficultyLevel(option.value)}
                    className={`p-2 rounded-lg border font-mono text-xs flex flex-col items-center ${difficultyLevel === option.value ? "bg-red-900/60 border-red-500 text-red-200" : "bg-black/40 border-red-900/50 text-red-400"}`}>
                    <span>{t(`difficulty.${option.value}`)}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
            <Button onClick={saveSettings} disabled={isSaving || !isFormValid} className={`w-full bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white rounded-lg font-mono text-sm py-3 transition-all ${!isFormValid || isSaving ? "opacity-50 cursor-not-allowed" : ""}`}>
              {isSaving ? t("continuing") : t("continue")}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}