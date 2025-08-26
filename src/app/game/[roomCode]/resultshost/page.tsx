"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Confetti from "react-confetti";
import { Trophy, Clock, Ghost, Zap, HeartPulse } from "lucide-react";
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
        speed: 1 + Math.random() * 1.5,
        delay: Math.random() * 3,
      }));
      setBloodDrips(newBlood);
    };

    generateBlood();
    const bloodInterval = setInterval(generateBlood, 6000);
    return () => clearInterval(bloodInterval);
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

  const columnsData = getColumnsLayout(playerResults);

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
          className="absolute top-0 w-0.5 h-16 bg-gradient-to-b from-red-600 to-red-800/50"
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
        className="relative z-10 container px-4 py-8 min-w-screen"
      >
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-4 mb-10 px-4"
        >
          <div className="flex justify-between items-start">
            <h1
              className="text-3xl md:text-4xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("title")}
            </h1>

            <div className="flex gap-4">
              <motion.button
                onClick={() => router.push("/")}
                whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(239, 68, 68, 0.8)" }}
                whileTap={{ scale: 0.95 }}
                className="bg-red-800 text-white font-mono py-3 px-6 text-sm md:text-base uppercase border-2 border-red-600 rounded-lg"
              >
                {t("homeButton")}
              </motion.button>
              <motion.button
                onClick={handlePlayAgain}
                disabled={isCreatingNewSession}
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(239, 68, 68, 0.9)" }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-mono py-3 px-6 text-sm md:text-base uppercase border-2 border-red-600 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingNewSession ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 mr-2 inline-block"
                  >
                    <Zap className="w-4 h-4" />
                  </motion.div>
                ) : null}
                {isCreatingNewSession ? t("creatingSession") : t("playAgain")}
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
              className={`text-5xl md:text-8xl font-bold font-mono tracking-wider transition-all duration-150 ${flickerText ? "text-red-500 opacity-100" : "text-red-900 opacity-30"
                } drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("result.titleLeaderboard")}
            </h1>
            <HeartPulse className="w-12 h-12 text-red-500 ml-4 animate-pulse" />
          </motion.div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, type: "spring", stiffness: 100 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto"
        >
          {columnsData.map((column, columnIndex) => (
            <div key={columnIndex} className="space-y-6">
              {column.map((player, playerIndex) => {
                const character = getCharacterByType(player.character_type);
                const animationDelay = 1.2 + (player.rank - 1) * 0.15;

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: player.rank % 2 === 0 ? 50 : -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.7,
                      delay: animationDelay,
                      type: "spring",
                      stiffness: 140,
                    }}
                    whileHover={{
                      scale: 1.02,
                      boxShadow: "0 0 25px rgba(220, 38, 38, 0.7)",
                      transition: { duration: 0.3 },
                    }}
                    className="relative bg-gradient-to-br from-gray-950/90 to-black/90 border-2 border-red-600/60 rounded-xl p-5 hover:border-red-500 transition-all duration-300 backdrop-blur-md overflow-hidden"
                    style={{
                      minHeight: "180px",
                      boxShadow: "0 0 15px rgba(220, 38, 38, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.7)",
                    }}
                  >
                    <div className="absolute top-3 right-3 w-2 h-2 bg-red-700 rounded-full opacity-50" />
                    <div className="absolute bottom-3 left-3 w-3 h-3 bg-red-800 rounded-full opacity-40" />

                    <div className="absolute -top-3 -left-3 w-14 h-14 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center text-white font-bold text-xl border-3 border-red-500/80 shadow-[0_0_10px_rgba(220,38,38,0.7)]">
                      <div className="relative">
                        {player.rank}
                        <motion.div
                          animate={{ y: [0, 3, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-red-600 rounded-b-full opacity-60"
                        />
                      </div>
                      {player.rank === 1 && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute -top-2 -right-2"
                        >
                          <Trophy className="w-5 h-5 text-yellow-300 drop-shadow-[0_0_6px_rgba(234,179,8,0.9)]" />
                        </motion.div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 h-full pt-3">
                      <div className="flex-shrink-0">
                        <div className="relative">
                          <div className="w-24 h-24 rounded-lg overflow-hidden border-3 border-red-500/70 shadow-[0_0_15px_rgba(220,38,38,0.5)] bg-gradient-to-br from-gray-900/50 to-black/50">
                            <Image
                              src={character.src || "/placeholder.svg"}
                              alt={character.alt}
                              width={96}
                              height={96}
                              className="w-full h-full object-cover"
                              style={{
                                filter: !player.isLolos
                                  ? "grayscale(80%) brightness(0.6) contrast(1.3) sepia(10%) hue-rotate(300deg)"
                                  : "brightness(1.1) contrast(1.2) saturate(1.2) drop-shadow(0 0 6px rgba(220,38,38,0.5))"
                              }}
                            />
                          </div>
                          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-700 to-purple-800 text-white text-xs px-2 py-1 rounded-full border border-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.5)]">
                            {character.name}
                          </div>
                          <motion.div
                            animate={{ opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 rounded-lg bg-gradient-to-br from-red-500/15 via-transparent to-red-500/15 pointer-events-none"
                          />
                        </div>
                      </div>

                      <div className="flex-grow space-y-3">
                        <div className="relative from-gray-800 to-black text-red-300 px-3 py-2 rounded-lg border border-red-600/50 flex items-center gap-2 shadow-[inset_0_1px_6px_rgba(0,0,0,0.7)]">
                          <h3 className="font-bold text-lg truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                            {player.nickname}
                          </h3>
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full opacity-60" />
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-1 from-gray-800 to-black text-red-300 px-3 py-2 rounded-lg border border-red-600/50 flex items-center gap-2 shadow-[inset_0_1px_6px_rgba(0,0,0,0.7)]">
                            <Clock className="w-4 h-4 text-red-400" />
                            <span className="font-mono text-base font-bold">{player.duration}</span>
                          </div>

                          <div
                            className={`flex-1 px-3 py-2 rounded-lg border text-center font-bold text-base shadow-[0_0_12px_rgba(0,0,0,0.7)] ${
                              player.isLolos
                                ? "bg-gradient-to-r from-green-600 to-green-700 text-red-300 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                                : "bg-gradient-to-r from-red-600 to-red-700 text-white-300 border-red-500 shadow-[inset_0_1px_6px_rgba(0,0,0,0.7)]"
                            }`}
                          >
                            {player.isLolos ? t("pass") : t("fail")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <motion.div
                      animate={{ y: [-3, 3, -3], opacity: [0.2, 0.4, 0.2] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute top-3 right-3 text-red-400/30"
                    >
                      <Ghost className="w-5 h-5" />
                    </motion.div>

                    {player.isLolos && (
                      <motion.div
                        animate={{ opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-br from-green-500/10 via-transparent to-green-500/10 pointer-events-none"
                      />
                    )}

                    {!player.isLolos && (
                      <motion.div
                        animate={{ opacity: [0.15, 0.3, 0.15] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-900/15 via-transparent to-red-900/15 pointer-events-none"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </motion.section>
      </motion.div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        .animate-pulse {
          animation: pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
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