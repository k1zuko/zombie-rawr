
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skull, Bone, HeartPulse, Ghost, Zap, Clock, ArrowRight, Settings, List } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useHostGuard } from "@/lib/host-guard";
import Link from "next/link";
import toast from "react-hot-toast";

const validChaserTypes = ["zombie", "monster1", "monster2", "monster3", "darknight"] as const;
type ChaserType = typeof validChaserTypes[number];

interface DifficultyOption {
  value: "easy" | "medium" | "hard";
  zombieAttackCountdown: number;
  inactivityPenalty: number;
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

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [gameDuration, setGameDuration] = useState<number>(10);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [userSetQuestionCount, setUserSetQuestionCount] = useState(false);
  const [chaserType, setChaserType] = useState<ChaserType>("zombie");
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>("medium");
  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([]);
  const [sounds, setSounds] = useState<{ whisper: HTMLAudioElement | null; heartbeat: HTMLAudioElement | null }>({
    whisper: null,
    heartbeat: null,
  });
  const [selectedChaser, setSelectedChaser] = useState<typeof chaserOptions[number] | null>(null);

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
      { value: "easy", zombieAttackCountdown: 30, inactivityPenalty: 25 },
      { value: "medium", zombieAttackCountdown: 20, inactivityPenalty: 10 },
      { value: "hard", zombieAttackCountdown: 10, inactivityPenalty: 5 },
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

  const handleDurationChange = (value: number[]) => {
    const newValue = value[0];
    if (newValue < 1 || newValue > 30) {
      setDurationError(t("durationError"));
      return;
    }
    setDurationError(null);
    setGameDuration(newValue);
  };


  const handleQuestionCountChange = (value: number[]) => {
    const newValue = value[0];
    if (newValue >= 5 && newValue <= totalQuestions) {
      setQuestionCount(newValue);
      setUserSetQuestionCount(true);
    }
  };

  const handleDifficultyChange = (value: string) => {
    setDifficultyLevel(value as DifficultyLevel);
  };

  const handleChaserSelect = (chaser: typeof chaserOptions[number]) => {
    setChaserType(chaser.value);
    setSelectedChaser(chaser);
  };

  useEffect(() => {
    if (!roomCode || typeof roomCode !== "string") {
      toast.error(t("errorMessages.invalidRoomCode"));
      router.push("/");
      return;
    }

    const fetchRoom = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("game_rooms")
          .select("*, chaser_type, quiz_id, difficulty_level")
          .eq("room_code", roomCode)
          .single();

        if (error || !data) {
          console.error(t("errorMessages.roomNotFoundLog"), error?.message);
          toast.error(t("errorMessages.roomNotFound"));
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
        setRoom({ ...data, chaser_type: fetchedChaserType, difficulty_level: fetchedDifficultyLevel });
        setGameDuration(data.duration ? data.duration / 60 : 10);
        setQuestionCount(data.question_count ?? 10);
        setChaserType(fetchedChaserType);
        setDifficultyLevel(fetchedDifficultyLevel);

        const { count: questionsCount, error: questionsError } = await supabase
          .from("quiz_questions")
          .select("*", { count: "exact", head: true })
          .eq("quiz_id", data.quiz_id);

        if (questionsError) {
          console.error("Error fetching questions count:", questionsError);
          setTotalQuestions(10);
        } else {
          const total = questionsCount || 10;
          setTotalQuestions(total);
          if (!userSetQuestionCount) {
            if (data.question_count) {
              setQuestionCount(data.question_count);
            } else {
              setQuestionCount(total <= 10 ? total : 10);
            }
          }
        }
      } catch (error) {
        console.error(t("errorMessages.fetchRoomFailedLog"), error);
        toast.error(t("errorMessages.fetchRoomFailed"));
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoom();
  }, [roomCode, router, t]);

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
      () => {
        setFlickerText((prev) => !prev);
      },
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

      const { error } = await supabase
        .from("game_rooms")
        .update({
          duration: durationInSeconds,
          question_count: questionCount,
          chaser_type: validatedChaserType,
          difficulty_level: validatedDifficultyLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id);

      if (error) throw error;

      router.push(`/host/${roomCode}`);
    } catch (error) {
      console.error(t("errorMessages.saveSettingsFailedLog"), error);
      toast.error(t("errorMessages.saveSettingsFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full relative z-10"
        >
          <div className="absolute inset-0 rounded-full border-4 border-red-900 border-l-transparent border-r-transparent animate-ping" />
        </motion.div>
        <motion.p
          className="absolute bottom-1/4 text-red-400 font-mono text-sm"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {t("loading")}
        </motion.p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="text-red-400 text-xl font-mono relative z-10 text-center p-6 border border-red-900/50 bg-black/60 backdrop-blur-sm">
          <Skull className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p>{t("roomNotFound")}</p>
          <p className="text-sm mt-2 text-red-300">{t("backToLobby")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      <audio src="/musics/background-music-room.mp3" autoPlay loop />
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
        {[...Array(12)].map((_, i) => (
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

      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJzY3JhdGNoZXMiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48cGF0aCBkPSJNMCAwTDUwMCA1MDAiIHN0cm9rZT0icmdiYSgyNTUsMCwwLDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48cGF0aCBkPSJNMCAxMDBMNTAwIDYwMCIgc3Ryb2tlPSJyZ2JhKDI1NSwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0wIDIwMEw1MDAgNzAwIiBzdHJva2U9InJnYmEoMjU1LDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NjcmF0Y2hlcykiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] opacity-20" />

      <div className="relative z-10 mx-auto p-7">
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-1 mb-10"
        >
          <div className="flex items-center justify-between mb-5 md:mb-0">
            <Link href={"/"}>
              <h1
                className="text-2xl md:text-4xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
              >
                {t("title")}
              </h1>
            </Link>
            <img
                src={`/logo/gameforsmartlogo-horror.png`}
                alt="Game for Smart Logo"
                className="w-36 md:w-52 lg:w-64 h-auto mr-3"
              />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
            className="flex justify-center items-center text-center mb-5"
          >
            <HeartPulse className="w-12 h-12 text-red-500 mr-4 animate-pulse" />
            <h1
              className={`text-4xl md:text-6xl font-bold font-mono tracking-wider transition-all duration-150 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("settingsTitle")}
            </h1>
            <HeartPulse className="w-12 h-12 text-red-500 ml-4 animate-pulse" />
          </motion.div>
          <p className="text-red-300 font-mono max-w-2xl mx-auto text-sm md:text-base">
            {t("settingsDescription")}
          </p>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6 lg:col-span-1"
          >
            <div className="bg-black/40 border border-red-900/50 p-6 rounded-lg backdrop-blur-sm">
              <div className="flex items-center mb-4">
                <Settings className="w-5 h-5 text-red-500 mr-2" />
                <h2 className="text-xl font-mono font-semibold text-red-400">{t("gameSettingsTitle")}</h2>
              </div>

              <div className="mb-6">
                <Label htmlFor="duration" className="text-red-300 mb-2 block font-medium text-sm font-mono flex items-center">
                  {t("gameDurationLabel")}
                  <Clock className="w-4 h-4 ml-2 text-red-500" />
                </Label>
                <Slider
                  id="duration"
                  min={5}
                  max={30}
                  step={5}
                  value={[gameDuration]}
                  onValueChange={handleDurationChange}
                  className="w-full mb-4"
                  aria-label={t("gameDurationLabel")}
                />
                <p className="text-red-400 font-mono text-sm">
                  {gameDuration} {t("minutes")}
                </p>
                {durationError && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-xs mt-1 animate-pulse"
                  >
                    {durationError}
                  </motion.p>
                )}
              </div>

              <div className="mb-6">
                <Label htmlFor="questionCount" className="text-red-300 mb-2 block font-medium text-sm font-mono flex items-center">
                  {t("questionCountLabel")}
                  <List className="w-4 h-4 ml-2 text-red-500" />
                </Label>
                <Slider
                  id="questionCount"
                  min={5}
                  max={totalQuestions}
                  step={5}
                  value={[questionCount]}
                  onValueChange={handleQuestionCountChange}
                  className="w-full"
                  aria-label={t("questionCountLabel")}
                />
                <p className="text-red-400 font-mono text-sm mt-2">
                  {questionCount} {t("questions")} {questionCount === totalQuestions ? `(${t("allLabel")})` : ""}
                </p>
                {questionCount > totalQuestions && (
                  <p className="text-red-500 text-xs mt-1 animate-pulse">{t("questionError")}</p>
                )}
              </div>

              <div>
                <Label className="text-red-300 mb-3 block font-medium text-sm font-mono flex items-center">
                  {t("difficultyLevelLabel")}
                  <Skull className="w-4 h-4 ml-2 text-red-500" />
                </Label>

                <div className="flex space-x-4">
                  {difficultyOptions.map((option) => (
                    <motion.label
                      key={option.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`flex-1 text-center p-3 rounded-lg cursor-pointer transition-all duration-200 border font-mono text-sm ${difficultyLevel === option.value
                        ? "bg-red-900/50 border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.5)] text-red-300"
                        : "bg-black/60 border-red-900/50 text-red-400 hover:bg-red-900/30"
                        }`}
                    >
                      <input
                        type="radio"
                        name="difficultyLevel"
                        value={option.value}
                        checked={difficultyLevel === option.value}
                        onChange={() => handleDifficultyChange(option.value)}
                        className="sr-only"
                      />
                      {t(`difficulty.${option.value}`)}
                    </motion.label>
                  ))}
                </div>
              </div>
            </div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="mt-6">
              <Button
                onClick={saveSettings}
                disabled={isSaving || !isFormValid}
                className={`w-full bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white rounded-lg font-mono text-lg py-6 shadow-lg shadow-red-900/30 transition-all ${!isFormValid || isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isSaving ? t("continuing") : t("continue")}
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <div className="bg-black/40 border border-red-900/50 p-6 rounded-lg h-full backdrop-blur-sm">
              <div className="flex items-center mb-6">
                <Ghost className="w-5 h-5 text-red-500 mr-2" />
                <h2 className="text-xl font-mono font-semibold text-red-400">{t("chaserSelectTitle")}</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-y-auto custom-scrollbar pr-2">
                {chaserOptions.map((chaser) => (
                  <motion.div
                    key={chaser.value}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="m-3"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleChaserSelect(chaser)}
                      onKeyDown={(e) => e.key === "Enter" && handleChaserSelect(chaser)}
                      className={`relative flex flex-col items-center p-4 rounded-lg cursor-pointer transition-all duration-300 border ${chaserType === chaser.value ? "border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.7)] bg-red-900/40" : "border-red-500/30 bg-black/40 hover:bg-red-900/20 hover:shadow-[0_0_10px_rgba(255,0,0,0.5)]"} h-full`}
                    >
                      <div className="relative w-24 h-24 mb-3">
                        <Image
                          src={chaser.gif}
                          alt={chaser.alt || `Chaser ${chaser.name}`}
                          fill
                          className="object-contain"
                          unoptimized
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                      <span className="text-red-400 font-mono text-center font-bold mb-1">{chaser.name}</span>
                      {chaserType === chaser.value && (
                        <motion.span
                          className="absolute top-2 right-2 text-red-400"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          ✔
                        </motion.span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* {selectedChaser && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-black/50 border border-red-900/50 rounded-lg"
                >
                  <div className="flex items-center">
                    <Skull className="w-5 h-5 text-red-500 mr-2" />
                    <h3 className="text-lg font-mono text-red-400">
                      {t("selectedChaser", { name: selectedChaser.name })}
                    </h3>
                  </div>
                  <p className="text-red-300 font-mono text-sm mt-2">{selectedChaser.description}</p>
                </motion.div>
              )} */}
            </div>
          </motion.div>
        </div>
      </div>

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
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(10, 0, 0, 0.8);
          border-left: 1px solid rgba(255, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #600000, #ff0000);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #800000, #ff3030);
        }
        .slider [role="slider"] {
          background: linear-gradient(to right, #ff0000, #600000);
          box-shadow: 0 0 8px rgba(255, 0, 0, 0.5);
        }
        input[type="radio"]:focus-visible + span {
          outline: 2px solid #ff0000;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}