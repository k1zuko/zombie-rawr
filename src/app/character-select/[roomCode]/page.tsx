
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skull, Bone, HeartPulse, Ghost, Zap, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useHostGuard } from "@/lib/host-guard";

const validChaserTypes = ["zombie", "monster1", "monster2", "monster3", "darknight"] as const;
type ChaserType = typeof validChaserTypes[number];

interface GameRoom {
  id: string;
  room_code: string;
  title: string | null;
  status: "waiting" | "playing" | "finished";
  max_players: number;
  duration: number | null;
  question_count: number | null;
  chaser_type: ChaserType;
}

export default function CharacterSelectPage() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameDuration, setGameDuration] = useState<string>("10");
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [userSetQuestionCount, setUserSetQuestionCount] = useState(false);
  const [chaserType, setChaserType] = useState<ChaserType>("zombie");
  const [flickerText, setFlickerText] = useState(true);
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([]);
  const [sounds, setSounds] = useState<{ whisper: HTMLAudioElement | null; heartbeat: HTMLAudioElement | null }>({
    whisper: null,
    heartbeat: null,
  });
  const [selectedChaser, setSelectedChaser] = useState<typeof chaserOptions[number] | null>(null);

  useHostGuard(roomCode)

  const chaserOptions = [
    {
      value: "zombie" as const,
      name: t("chasers.zombie.name"),
      gif: "/character/chaser/zombie.gif",
      alt: t("chasers.zombie.alt"),
      description: t("chasers.zombie.description"),
    },
    {
      value: "monster1" as const,
      name: t("chasers.monster1.name"),
      gif: "/character/chaser/monster1.gif",
      alt: t("chasers.monster1.alt"),
      description: t("chasers.monster1.description"),
    },
    {
      value: "monster2" as const,
      name: t("chasers.monster2.name"),
      gif: "/character/chaser/monster2.gif",
      alt: t("chasers.monster2.alt"),
      description: t("chasers.monster2.description"),
    },
    {
      value: "monster3" as const,
      name: t("chasers.monster3.name"),
      gif: "/character/chaser/monster3.gif",
      alt: t("chasers.monster3.alt"),
      description: t("chasers.monster3.description"),
    },
    {
      value: "darknight" as const,
      name: t("chasers.darknight.name"),
      gif: "/character/chaser/darknight.gif",
      alt: t("chasers.darknight.alt"),
      description: t("chasers.darknight.description"),
    },
  ];

  const handleQuestionCountChange = (value: string) => {
    setQuestionCount(Number(value));
    setUserSetQuestionCount(true); // tandai user udah pilih manual
  };

  const questionOptions = useMemo(() => {
    const opts: number[] = [];
    for (let i = 5; i <= totalQuestions; i += 5) {
      opts.push(i);
    }
    return opts;
  }, [totalQuestions]);

  useEffect(() => {
    setSounds({
      whisper: new Audio("/sounds/whisper.mp3"),
      heartbeat: new Audio("/sounds/heartbeat.mp3"),
    });

    return () => {
      sounds.whisper?.pause();
      sounds.heartbeat?.pause();
    };
  }, []);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const { data, error } = await supabase
          .from("game_rooms")
          .select("*, chaser_type, quiz_id")
          .eq("room_code", roomCode)
          .single();

        if (error || !data) {
          console.error(t("errorMessages.roomNotFoundLog"), error);
          alert(t("errorMessages.roomNotFound"));
          router.push("/");
          return;
        }

        const fetchedChaserType = validChaserTypes.includes(data.chaser_type) ? data.chaser_type : "zombie";
        setRoom({ ...data, chaser_type: fetchedChaserType });
        setGameDuration((data.duration ? data.duration / 60 : 10).toString());
        setQuestionCount(data.question_count ?? 20);
        setChaserType(fetchedChaserType);

        const { count: questionsCount, error: questionsError } = await supabase
          .from("quiz_questions")
          .select("*", { count: "exact", head: true })
          .eq("quiz_id", data.quiz_id);

        if (questionsError) {
          console.error("Error fetching questions count:", questionsError);
          setTotalQuestions(20); // Fallback
        } else {
          const total = questionsCount || 20;
          setTotalQuestions(total);
          if (!userSetQuestionCount) {
            if (data.question_count) {
              setQuestionCount(data.question_count);
            } else {
              setQuestionCount(total <= 15 ? total : 15);
            }
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error(t("errorMessages.fetchRoomFailedLog"), error);
        alert(t("errorMessages.fetchRoomFailed"));
        router.push("/");
      }
    };

    fetchRoom();
  }, [roomCode, router, t]);

  useEffect(() => {
    const generateBlood = () => {
      const newBlood = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        speed: 0.5 + Math.random() * 2,
        delay: Math.random() * 5,
      }));
      setBloodDrips(newBlood);
    };

    generateBlood();
    const bloodInterval = setInterval(() => {
      generateBlood();
    }, 8000);

    return () => clearInterval(bloodInterval);
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

  useEffect(() => {
    if (selectedChaser) {
      sounds.whisper?.play().catch((e) => console.log("Autoplay prevented:", e));
      sounds.heartbeat?.play().catch((e) => console.log("Autoplay prevented:", e));
    }

    return () => {
      sounds.whisper?.pause();
      sounds.heartbeat?.pause();
    };
  }, [selectedChaser]);

  const saveSettings = async () => {
    if (!room) return;

    const validatedChaserType = validChaserTypes.includes(chaserType) ? chaserType : "zombie";
    const durationInSeconds = parseInt(gameDuration) * 60;
    try {
      const { error } = await supabase
        .from("game_rooms")
        .update({
          duration: durationInSeconds,
          question_count: questionCount,
          chaser_type: validatedChaserType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id);

      if (error) throw error;

      router.push(`/host/${roomCode}`);
    } catch (error) {
      console.error(t("errorMessages.saveSettingsFailedLog"), error);
      alert(t("errorMessages.saveSettingsFailed"));
    }
  };

  const handleChaserSelect = (chaser: typeof chaserOptions[number]) => {
    setChaserType(chaser.value);
    setSelectedChaser(chaser);

    const selectSound = new Audio("/sounds/select.mp3");
    selectSound.volume = 0.6;
    selectSound.play().catch((e) => console.log("Sound play prevented:", e));
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^[0-9]+$/.test(value)) {
      setGameDuration(value);
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    router.push(`/character-select/${roomCode}?lng=${lng}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/static-noise.gif')] opacity-20 pointer-events-none" />
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
        <div className="absolute inset-0 bg-[url('/images/static-noise.gif')] opacity-15 pointer-events-none" />
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

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-6xl">
        {/* <div className="fixed top-2 right-2 space-x-2 z-30">
          <Button
            variant="ghost"
            onClick={() => changeLanguage("en")}
            className={`text-red-500 hover:bg-red-900/20 ${i18n.language === "en" ? "bg-red-900/30" : ""}`}
          >
            EN
          </Button>
          <Button
            variant="ghost"
            onClick={() => changeLanguage("id")}
            className={`text-red-500 hover:bg-red-900/20 ${i18n.language === "id" ? "bg-red-900/30" : ""}`}
          >
            ID
          </Button>
        </div> */}

        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-6">
            <HeartPulse className="w-12 h-12 text-red-500 mr-4 animate-pulse" />
            <h1
              className={`text-5xl md:text-6xl font-bold font-mono tracking-widest transition-all duration-150 ${flickerText ? "text-red-500 opacity-100" : "text-red-900 opacity-30"
                } drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("settingsTitle")}
            </h1>
            <HeartPulse className="w-12 h-12 text-red-500 ml-4 animate-pulse" />
          </div>
          <p className="text-red-300 font-mono max-w-2xl mx-auto text-sm md:text-base">
            {t("settingsDescription")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6 lg:col-span-1"
          >
            <div className="bg-black/40 border border-red-900/50 p-6 rounded-lg backdrop-blur-sm">
              <div className="flex items-center mb-4">
                <Clock className="w-5 h-5 text-red-500 mr-2" />
                <h2 className="text-xl font-mono text-red-400">{t("gameSettingsTitle")}</h2>
              </div>

              <div className="mb-6">
                <Label htmlFor="duration" className="text-red-300 mb-2 block font-medium text-sm font-mono">
                  {t("gameDurationLabel")}
                </Label>
                <Input
                  id="duration"
                  name="duration"
                  type="number"
                  min="1"
                  value={gameDuration}
                  onChange={handleDurationChange}
                  className="bg-black/50 border-red-900/50 text-red-400 font-mono focus:border-red-400/50 focus:ring-red-400/20"
                  placeholder={t("gameDurationPlaceholder")}
                />
              </div>

              <div>
                <Label htmlFor="questionCount" className="text-red-300 mb-2 block font-medium text-sm font-mono">
                  {t("questionCountLabel")}
                </Label>
                <Select value={questionCount.toString()} onValueChange={handleQuestionCountChange}>
                  <SelectTrigger className="w-full bg-black/70 border-red-800/70 text-red-400 rounded-lg hover:bg-red-900/30 transition-colors font-mono">
                    <SelectValue placeholder={t("selectQuestionCount")} />
                  </SelectTrigger>
                  <SelectContent className="bg-black/95 text-red-400 border-red-800/50 rounded-lg font-mono backdrop-blur-sm">
                    {questionOptions.map((opt) => (
                      <SelectItem key={opt} value={opt.toString()}>
                        {opt} {opt === totalQuestions ? `(${t("allLabel")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-black/40 border border-red-900/50 p-6 rounded-lg backdrop-blur-sm">
              <div className="flex items-center mb-4">
                <Zap className="w-5 h-5 text-red-500 mr-2" />
                <h2 className="text-xl font-mono text-red-400">{t("summaryTitle")}</h2>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-red-300 font-mono text-sm">
                  <span>{t("gameDurationLabel")}</span>
                  <span className="text-red-400">{t("gameDurationValue", { minutes: gameDuration })}</span>
                </div>
                <div className="flex justify-between text-red-300 font-mono text-sm">
                  <span>{t("questionCountLabel")}</span>
                  <span className="text-red-400">{t("questionCountValue", { count: questionCount })}</span>
                </div>
                <div className="flex justify-between text-red-300 font-mono text-sm">
                  <span>{t("chaserLabel")}</span>
                  <span className="text-red-400">
                    {chaserOptions.find((c) => c.value === chaserType)?.name || t("chaserNotSelected")}
                  </span>
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="mt-6">
                <Button
                  onClick={saveSettings}
                  className="w-full bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white rounded-lg font-mono text-lg py-6 shadow-lg shadow-red-900/30 transition-all"
                >
                  {t("startButton")}
                </Button>
              </motion.div>
            </div>
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
                <h2 className="text-xl font-mono text-red-400">{t("chaserSelectTitle")}</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
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
                      className={`relative flex flex-col items-center p-4 rounded-lg cursor-pointer transition-all duration-300 border ${chaserType === chaser.value
                        ? "border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.7)] bg-red-900/40"
                        : "border-red-500/30 bg-black/40 hover:bg-red-900/20 hover:shadow-[0_0_10px_rgba(255,0,0,0.5)]"
                        } h-full`}
                    >
                      <div className="relative w-24 h-24 mb-3">
                        <Image
                          src={chaser.gif}
                          alt={chaser.alt}
                          fill
                          className="object-contain"
                          unoptimized
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                      <span className="text-red-400 font-mono text-center font-bold mb-1">{chaser.name}</span>
                      <span className="text-red-300 font-mono text-xs text-center opacity-80">{chaser.description}</span>
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

              {selectedChaser && (
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
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-4 left-0 right-0 text-center text-red-900/50 font-mono text-xs"
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        {t("warningText")}
      </motion.div>

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
      `}</style>
    </div>
  );
}
