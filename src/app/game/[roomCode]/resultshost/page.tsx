"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Image from "next/image";
import Confetti from "react-confetti";
import { Trophy, Clock, Ghost, Zap, HeartPulse, RotateCw, Home, X } from 'lucide-react';
import { t } from "i18next";
import { useHostGuard } from "@/lib/host-guard";

const validChaserTypes = ["zombie", "monster1", "monster2", "monster3", "darknight"] as const;
type ChaserType = typeof validChaserTypes[number];

interface Player {
  id: string;
  nickname: string;
  character_type: string;
  score: number;
  is_alive: boolean;
  joined_at: string;
}

interface GameCompletion {
  id: string;
  player_id: string;
  room_id: string;
  final_health: number;
  correct_answers: number;
  total_questions_answered: number;
  is_eliminated: boolean;
  completion_type: string;
  completed_at: string;
  survival_duration: number;
}

interface GameRoom {
  id: string;
  room_code: string;
  title: string;
  status: string;
  max_players: number;
  current_phase: string;
  game_start_time: string | null;
  questions: any[];
  quiz_id: string;
  duration: number | null;
  question_count: number | null;
  chaser_type: ChaserType;
  host_id: string; // Added to store host_id
}

interface PlayerResult {
  id: string;
  nickname: string;
  character_type: string;
  rank: number;
  duration: string;
  isLolos: boolean;
  correctAnswers: number;
  totalQuestions: number;
  finalScore: number;
  finalHealth: number;
  completionTime: string;
  survivalSeconds: number;
}

const characterGifs = [
  { src: "/character/player/character.gif", alt: "Karakter Hijau", color: "bg-green-600", type: "robot1", name: "Hijau" },
  { src: "/character/player/character1.gif", alt: "Karakter Biru", color: "bg-blue-600", type: "robot2", name: "Biru" },
  { src: "/character/player/character2.gif", alt: "Karakter Merah", color: "bg-red-600", type: "robot3", name: "Merah" },
  { src: "/character/player/character3.gif", alt: "Karakter Ungu", color: "bg-purple-600", type: "robot4", name: "Ungu" },
  { src: "/character/player/character4.gif", alt: "Karakter Oranye", color: "bg-orange-600", type: "robot5", name: "Oranye" },
  { src: "/character/player/character5.gif", alt: "Karakter Kuning", color: "bg-yellow-600", type: "robot6", name: "Kuning" },
  { src: "/character/player/character6.gif", alt: "Karakter Abu-abu", color: "bg-gray-600", type: "robot7", name: "Abu-abu" },
  { src: "/character/player/character7.gif", alt: "Karakter Pink", color: "bg-pink-600", type: "robot8", name: "Pink" },
  { src: "/character/player/character8.gif", alt: "Karakter Cokelat", color: "bg-amber-900", type: "robot9", name: "Cokelat" },
  { src: "/character/player/character9.gif", alt: "Karakter Emas", color: "bg-yellow-700", type: "robot10", name: "Emas" },
];

export default function ResultsHostPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);

  // framer variants
  const listVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.08 },
    },
  }

  const cardVariants: Variants = {
    hidden: (i: number) => ({
      opacity: 0,
      y: 18,
      scale: 0.97,
    }),
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring", // ✅ literal, bukan string generic
        stiffness: 180,
        damping: 20,
      },
    },
  }

  const infoVariants: Variants = {
    hidden: { opacity: 0, x: -14 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.45 },
    },
  }


  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [showContent, setShowContent] = useState(false);
  const [bloodDrips, setBloodDrips] = useState<Array<{ id: number; left: number; speed: number; delay: number }>>([]);
  const [isCreatingNewSession, setIsCreatingNewSession] = useState(false);
  const [flickerText, setFlickerText] = useState(true);

  useHostGuard(roomCode);

  const getCharacterByType = useCallback((type: string) => {
    return characterGifs.find((char) => char.type === type) || characterGifs[0];
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    const flickerInterval = setInterval(
      () => {
        setFlickerText((prev) => !prev);
      },
      100 + Math.random() * 150,
    );

    return () => {
      clearInterval(flickerInterval);
    };
  }, []);

  const calculateAccurateDuration = useCallback(
    (gameStartTime: string | null, completedAt: string, joinedAt: string, survivalDuration?: number) => {
      if (survivalDuration !== undefined && survivalDuration > 0) {
        return survivalDuration;
      }
      if (!gameStartTime) return 0;
      const startTime = new Date(gameStartTime).getTime();
      const endTime = new Date(completedAt).getTime();
      const joinTime = new Date(joinedAt).getTime();
      const effectiveStart = Math.max(startTime, joinTime);
      const durationMs = Math.max(0, endTime - effectiveStart);
      return Math.floor(durationMs / 1000);
    },
    [],
  );

  const getColumnsLayout = useCallback((players: PlayerResult[]) => {
    const leftColumn = players.slice(0, Math.ceil(players.length / 2));
    const rightColumn = players.slice(Math.ceil(players.length / 2));
    return [leftColumn, rightColumn].filter((column) => column.length > 0);
  }, []);

  const generateRoomCode = useCallback(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array(6)
      .fill(0)
      .map(() => chars[Math.floor(Math.random() * chars.length)])
      .join("");
  }, []);

  const handlePlayAgain = useCallback(async () => {
    if (!gameRoom) return;
    setIsCreatingNewSession(true);
    try {
      // Clean up previous game data
      await Promise.all([
        supabase.from("game_completions").delete().eq("room_id", gameRoom.id),
        supabase.from("player_health_states").delete().eq("room_id", gameRoom.id),
        supabase.from("game_states").delete().eq("room_id", gameRoom.id),
        supabase.from("players").delete().eq("room_id", gameRoom.id),
        supabase.from("game_rooms").delete().eq("id", gameRoom.id),
      ]);

      const newRoomCode = generateRoomCode();
      const tabHostId = crypto.randomUUID(); // Generate new host ID for the session
      sessionStorage.setItem("currentHostId", tabHostId); // Store new host ID

      // Validate chaser_type
      const validatedChaserType = validChaserTypes.includes(gameRoom.chaser_type)
        ? gameRoom.chaser_type
        : "zombie";

      // Create new room with previous settings
      const { data: newRoom, error: newRoomError } = await supabase
        .from("game_rooms")
        .insert({
          room_code: newRoomCode,
          title: gameRoom.title || "New Game",
          quiz_id: gameRoom.quiz_id,
          status: "waiting",
          // max_players: gameRoom.max_players || 10,
          duration: gameRoom.duration || 600,
          question_count: gameRoom.question_count || 20,
          chaser_type: validatedChaserType,
          current_phase: "lobby",
          host_id: tabHostId, // Set new host ID
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (newRoomError || !newRoom) {
        throw new Error(`Failed to create new room: ${newRoomError?.message || "No room data"}`);
      }

      // Redirect to the new host page
      router.push(`/host/${newRoomCode}`);
    } catch (error) {
      console.error("Failed to create new session:", error);
      setLoadingError(t("errorMessages.createNewSessionFailed"));
    } finally {
      setIsCreatingNewSession(false);
    }
  }, [gameRoom, router, generateRoomCode, t]);

  const fetchGameData = useCallback(async () => {
    if (!roomCode) {
      setLoadingError(t("errorMessages.invalidRoomCode"));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("*, questions, host_id") // Added host_id to the select query
        .eq("room_code", roomCode.toUpperCase())
        .single();

      if (roomError || !room) throw new Error(t("errorMessages.roomNotFound"));

      setGameRoom(room);

      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id);

      if (playersError) throw new Error(t("errorMessages.fetchPlayersFailed"));

      const { data: completionData, error: completionError } = await supabase
        .from("game_completions")
        .select("*")
        .eq("room_id", room.id)
        .order("completed_at", { ascending: false });

      if (completionError) console.error("Error fetching completions:", completionError);

      const uniqueCompletions = completionData?.reduce((acc: GameCompletion[], current: GameCompletion) => {
        if (!acc.some((c) => c.player_id === current.player_id)) acc.push(current);
        return acc;
      }, []) || [];

      const { data: healthData, error: healthError } = await supabase
        .from("player_health_states")
        .select("*")
        .eq("room_id", room.id);

      if (healthError) console.error("Error fetching health states:", healthError);

      const totalQuestions = room.questions?.length || 0;
      const gameEndTime = new Date().toISOString();

      const processedResults: PlayerResult[] = (playersData || []).map((player: Player) => {
        const completion = uniqueCompletions.find((c: { player_id: string; }) => c.player_id === player.id);
        const healthState = healthData?.find((h) => h.player_id === player.id);

        let finalHealth = 3;
        let survivalSeconds = 0;
        let isEliminated = false;

        if (completion) {
          finalHealth = completion.final_health;
          isEliminated = completion.is_eliminated;
          survivalSeconds = calculateAccurateDuration(
            room.game_start_time,
            completion.completed_at,
            player.joined_at,
            completion.survival_duration,
          );
        } else if (healthState) {
          finalHealth = healthState.health;
          isEliminated = finalHealth <= 0;
          survivalSeconds = calculateAccurateDuration(room.game_start_time, gameEndTime, player.joined_at);
        } else {
          survivalSeconds = 0;
          isEliminated = true;
          finalHealth = 0;
        }

        const isLolos = !isEliminated && finalHealth > 0;
        const completionTime = completion ? completion.completed_at : gameEndTime;
        const duration = formatDuration(survivalSeconds);
        const correctAnswers = completion ? completion.correct_answers : 0;
        const finalScore = correctAnswers * 100 + finalHealth * 50;

        return {
          id: player.id,
          nickname: player.nickname,
          character_type: player.character_type,
          rank: 0,
          duration,
          isLolos,
          correctAnswers,
          totalQuestions,
          finalScore,
          finalHealth,
          completionTime,
          survivalSeconds,
        };
      });

      const rankedResults = processedResults
        .sort((a, b) => {
          if (a.isLolos !== b.isLolos) return a.isLolos ? -1 : 1;
          if (a.finalScore !== b.finalScore) return b.finalScore - a.finalScore;
          return a.isLolos ? a.survivalSeconds - b.survivalSeconds : b.survivalSeconds - a.survivalSeconds;
        })
        .map((result, index) => ({
          ...result,
          rank: index + 1,
        }));

      setPlayerResults(rankedResults);

      if (rankedResults.some((r) => r.isLolos)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }

      setTimeout(() => setShowContent(true), 1000);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setLoadingError(t("errorMessages.fetchGameDataFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, calculateAccurateDuration, formatDuration, t]);

  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const generateBlood = () => {
      const newBlood = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        speed: 2 + Math.random() * 1.5,
        delay: Math.random() * 3,
      }));
      setBloodDrips(newBlood);
    };

    generateBlood();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex items-center justify-center relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.6, -0.05, 0.01, 0.99] }}
          className="text-red-400 text-4xl font-bold font-mono flex items-center space-x-4"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Ghost className="w-10 h-10" />
          </motion.div>
          <span>{t("loading")}</span>
        </motion.div>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.6, -0.05, 0.01, 0.99] }}
          className="text-center flex flex-col items-center justify-center h-full"
        >
          <Ghost className="w-16 h-16 text-red-400 mb-4" />
          <p className="text-red-400 text-2xl font-mono mb-6">{loadingError}</p>
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(239, 68, 68, 0.8)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="bg-red-800 text-white font-mono py-3 px-8 border-2 border-red-600 rounded-lg"
          >
            {t("tryAgain")}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 relative overflow-hidden select-none font-mono">
      <AnimatePresence>
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={300}
            colors={["#8B0000", "#FF0000", "#4B0082", "#2E8B57"]}
            gravity={0.2}
            wind={0.01}
            tweenDuration={4000}
          />
        )}
      </AnimatePresence>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(139,0,0,0.2)_0%,_transparent_70%)]">
        <div className="absolute inset-0 opacity-15">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-48 h-48 bg-red-900 rounded-full mix-blend-multiply blur-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: 0.2 + Math.random() * 0.3,
              }}
            />
          ))}
        </div>
      </div>

      {bloodDrips.map((drip) => (
        <motion.div
          key={drip.id}
          initial={{ y: -100 }}
          animate={{ y: windowSize.height }}
          transition={{ duration: drip.speed, delay: drip.delay, ease: "linear", repeat: Infinity }}
          className="fixed top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
          style={{ left: `${drip.left}%`, opacity: 0.6 + Math.random() * 0.2 }}
        />
      ))}

      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ y: [-10, 10, -10], rotate: [0, 5, -5, 0], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 5 + Math.random() * 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute text-red-900/15"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              fontSize: `${1.5 + Math.random() * 2}rem`,
            }}
          >
            <Ghost />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0.9 }}
        transition={{ duration: 1.2, ease: [0.6, -0.05, 0.01, 0.99] }}
        className="relative z-10 container px-4 py-3 min-w-screen"
      >
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-3 mb-10 px-4"
        >
          <div className="flex justify-between items-center">
            <h1
              className="text-4xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("title")}
            </h1>

            <div className="flex w-fit gap-2 items-center">
              <Image src={`/logo/Gemini_Generated_Image_90360u90360u9036-removebg-preview.png`} alt="" width={254} height={0} className="mr-3" />
              {/* Tombol Home */}
              <motion.button
                onClick={() => router.push("/")}
                whileHover={{ scale: 1.05, boxShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
                whileTap={{ scale: 0.95 }}
                // Ganti padding & tambahkan aria-label
                className="bg-red-800 text-white p-2 border-2 border-red-600 rounded-md"
                aria-label={t("homeButton")} // Penting untuk aksesibilitas
              >
                <Home className="w-4 h-4" />
              </motion.button>

              {/* Tombol Play Again */}
              <motion.button
                onClick={handlePlayAgain}
                disabled={isCreatingNewSession}
                whileHover={{ scale: 1.05, boxShadow: "0 0 12px rgba(239, 68, 0.8)" }}
                whileTap={{ scale: 0.95 }}
                // Ganti padding & tambahkan aria-label
                className="bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white p-2 border-2 border-red-600 rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t("playAgain")} // Penting untuk aksesibilitas
              >
                {isCreatingNewSession ? (
                  // State loading: tampilkan ikon Zap yang berputar
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RotateCw className="w-4 h-4" />
                  </motion.div>
                ) : (
                  // State default: tampilkan ikon Play Again
                  <RotateCw className="w-4 h-4" />
                )}
              </motion.button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
            className="flex justify-center items-center text-center"
          >
            <HeartPulse className="w-12 h-12 text-red-500 mr-4 animate-pulse" />
            <h1
              className={`text-7xl font-bold font-mono tracking-wider transition-all duration-150 animate-pulse text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("result.titleLeaderboard")}
            </h1>
            <HeartPulse className="w-12 h-12 text-red-500 ml-4 animate-pulse" />
          </motion.div>
        </motion.header>

        {/* ===== PLAYER GRID (semua sekaligus) ===== */}
        <motion.section
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="max-w-none mx-auto"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 px-7">
            <AnimatePresence mode="popLayout">
              {playerResults.map((player, idx) => {
                const character = getCharacterByType(player.character_type);
                return (
                  <motion.div
                    key={player.id}
                    custom={idx}
                    variants={cardVariants}
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0, scale: 0.85, x: idx % 2 ? 80 : -80, transition: { duration: 0.36 } }}
                    whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(220,38,38,0.18)" }}
                    className="relative bg-gradient-to-br from-gray-950/80 to-black/90 border border-red-800/50 rounded-lg p-3 text-left overflow-hidden"
                    style={{ minHeight: 120 }}
                  >
                    {/* Rank bubble top-left */}
                    <div className="absolute -top-3 -left-3 w-12 h-12 rounded-full bg-red-700 flex items-center justify-center text-white font-bold text-lg border-2 border-red-500/80 shadow-[0_6px_18px_rgba(220,38,38,0.4)] z-10">
                      {player.rank}
                    </div>

                    {/* Character + Info */}
                    <div className="flex items-center gap-4 h-full">
                      <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-black/60 flex items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]">
                        <img
                          src={character.src}
                          alt={character.alt}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <motion.div
                        variants={infoVariants}
                        className="flex-1 grid grid-rows-[auto_auto_auto] gap-2"
                      >
                        <div
                          className="text-red-300 font-bold text-lg truncate font-mono"
                          title={player.nickname}
                        >
                          {player.nickname}
                        </div>
                        <div className="flex items-center gap-2 text-red-300 text-sm font-mono">
                          <Clock className="w-4 h-4 text-red-400" />
                          <span>{player.duration ?? "--:--"}</span>
                        </div>
                        <div
                          className={`inline-block px-3 py-1 rounded-md text-xs w-fit font-bold
                  ${player.isLolos
                              ? "bg-gradient-to-r from-green-400 to-green-500 text-black border border-green-300 shadow-[0_8px_24px_rgba(34,197,94,0.12)]"
                              : "bg-gradient-to-r from-red-700 to-red-800 text-white border border-red-700"
                            }`}
                        >
                          {player.isLolos ? t("pass") : t("fail")}
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.section>
      </motion.div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        .animate-pulse {
          animation: pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 90% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes fall {
          to { transform: translateY(100vh); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(90deg); }
        }
      `}</style>
    </div>
  );
}