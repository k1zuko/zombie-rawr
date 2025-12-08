"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { mysupa, supabase } from "@/lib/supabase";
import { motion, AnimatePresence, Variants } from "framer-motion";
import Image from "next/image";
import Confetti from "react-confetti";
import { Trophy, Clock, Ghost, Zap, HeartPulse, RotateCw, Home, X } from 'lucide-react';
import { t } from "i18next";
import { useHostGuard } from "@/lib/host-guard";
import LoadingScreen from "@/components/LoadingScreen";
import { generateGamePin } from "@/utils/gameHelpers";

const validChaserTypes = ["zombie", "monster1", "monster2", "monster3", "darknight"] as const;
type ChaserType = typeof validChaserTypes[number];

interface Player {
  player_id: string;
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
  { type: "robot1", name: "Hijau", src: "/character/player/character.webp", alt: "Karakter Hijau" },
  { type: "robot2", name: "Biru", src: "/character/player/character1-crop.webp", alt: "Karakter Biru" },
  { type: "robot3", name: "Merah", src: "/character/player/character2-crop.webp", alt: "Karakter Merah" },
  { type: "robot4", name: "Ungu", src: "/character/player/character3-crop.webp", alt: "Karakter Ungu" },
  { type: "robot5", name: "Oranye", src: "/character/player/character4-crop.webp", alt: "Karakter Oranye" },
  { type: "robot6", name: "Kuning", src: "/character/player/character5.webp", alt: "Karakter Kuning" },
  { type: "robot7", name: "Abu-abu", src: "/character/player/character6.webp", alt: "Karakter Abu-abu" },
  { type: "robot8", name: "Pink", src: "/character/player/character7-crop.webp", alt: "Karakter Pink" },
  { type: "robot9", name: "Cokelat", src: "/character/player/character8-crop.webp", alt: "Karakter Cokelat" },
  { type: "robot10", name: "Emas", src: "/character/player/character9-crop.webp", alt: "Karakter Emas" },

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

  const handlePlayAgain = async () => {
    if (!roomCode) return;
    setIsCreatingNewSession(true);

    try {
      // 1. Ambil session lama dari mysupa (QuizRush)
      const { data: oldSess, error: oldErr } = await mysupa
        .from("sessions")
        .select("quiz_id, host_id, question_limit, total_time_minutes, difficulty, current_questions")
        .eq("game_pin", roomCode.toUpperCase())
        .single();

      if (oldErr || !oldSess) throw new Error("Session lama tidak ditemukan");

      // 2. Shuffle & ambil soal sesuai question_limit
      const questions = oldSess.current_questions || [];
      const shuffled = questions.sort(() => Math.random() - 0.5);
      const selectedQuestions = shuffled.slice(0, oldSess.question_limit || 5);

      // 3. Generate PIN baru
      const newPin = generateGamePin(6); // pastikan kamu punya fungsi ini

      // 4. BUAT SESSION BARU DI mysupa (untuk real-time gameplay)
      const { error: mysupaErr } = await mysupa
        .from("sessions")
        .insert({
          game_pin: newPin,
          quiz_id: oldSess.quiz_id,
          host_id: oldSess.host_id,
          status: "waiting",
          question_limit: oldSess.question_limit,
          total_time_minutes: oldSess.total_time_minutes,
          difficulty: oldSess.difficulty,
          current_questions: selectedQuestions,
        });

      if (mysupaErr) throw mysupaErr;

      // 5. BUAT BARU DI supabase UTAMA (gameforsmart) – agar bisa di-join & masuk leaderboard
      const { error: mainErr } = await supabase
        .from("game_sessions")
        .insert({
          game_pin: newPin,
          quiz_id: oldSess.quiz_id,
          host_id: oldSess.host_id,
          status: "waiting",
          application: "quizrush",
          total_time_minutes: oldSess.total_time_minutes || 5,
          question_limit: (oldSess.question_limit || 5).toString(),
          difficulty: oldSess.difficulty,
          current_questions: selectedQuestions,
          participants: [],
          responses: [],
        });

      if (mainErr) throw mainErr;

      console.log("Restart berhasil! PIN baru:", newPin);

      // 6. Redirect ke lobby (bukan langsung settings)
      router.push(`/host/${newPin}/lobby`);

    } catch (err: any) {
      console.error("Gagal restart game:", err);
      alert("Gagal membuat game baru: " + err.message);
      setIsCreatingNewSession(false);
    }
  };

  const fetchGameData = useCallback(async () => {
    if (!roomCode) return;

    try {
      setIsLoading(true);

      // 1. Ambil session berdasarkan game_pin
      const { data: session, error: sessErr } = await mysupa
        .from("sessions")
        .select("id, quiz_id, question_limit, total_time_minutes, started_at, difficulty")
        .eq("game_pin", roomCode.toUpperCase())
        .single();

      if (sessErr || !session) throw new Error("Session tidak ditemukan");

      // 2. Ambil semua participant yang sudah selesai
      const { data: participants } = await mysupa
        .from("participants")
        .select("*")
        .eq("session_id", session.id)
        .order("score", { ascending: false });

      const totalQuestions = session.question_limit || 5;

      const results: PlayerResult[] = (participants || []).map((p, index) => {
        const survival = p.finished_at && session.started_at
          ? Math.floor((new Date(p.finished_at).getTime() - new Date(session.started_at).getTime()) / 1000)
          : 0;

        const isLolos = p.health.current > 0 && p.finished_at !== null;

        return {
          id: p.id,
          nickname: p.nickname,
          character_type: p.character_type || "robot1",
          rank: index + 1,
          duration: formatDuration(survival),
          isLolos,
          correctAnswers: p.correct_answers,
          totalQuestions,
          finalScore: p.score,
          finalHealth: p.health.current,
          completionTime: p.finished_at || p.joined_at,
          survivalSeconds: survival,
        };
      });

      setPlayerResults(results);

      if (results.some(r => r.isLolos)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }

      setTimeout(() => setShowContent(true), 1000);
      setIsLoading(false)
    } catch (err) {
      console.error(err);
      setLoadingError("Gagal load hasil");
      setIsLoading(false)
    }
  }, [roomCode, formatDuration]);

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

  if (isLoading) <LoadingScreen children={undefined} />

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
        className="relative z-10 container p-7 min-w-screen"
      >
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
          className="flex flex-col gap-5 mb-10 px-2"
        >
          <div className="flex justify-between items-center">
            <Image
              src="/logo/quizrushlogo.png"
              alt="QuizRush Logo"
              width={140}   // turunin sedikit biar proporsional
              height={35}   // sesuaikan tinggi
              className="w-32 md:w-40 lg:w-48 h-auto hidden sm:block"   // ini yang paling berpengaruh
              unoptimized
            />

            <div className="flex w-fit gap-2 items-center">
              <img
                src={`/logo/gameforsmartlogo-horror.png`}
                alt="Game for Smart Logo"
                className="w-36 md:w-52 lg:w-64 h-auto mr-3 hidden sm:block"
              />
              {/* Tombol Home dihapus dari header */}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
            className="flex justify-center items-center text-center"
          >

            <h1
              className={`text-3xl sm:text-5xl lg:text-7xl font-bold font-mono tracking-wider transition-all duration-150 animate-pulse text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}
              style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
            >
              {t("result.titleLeaderboard")}
            </h1>

          </motion.div>
        </motion.header>

        {/* ===== PLAYER GRID (semua sekaligus) ===== */}
        <motion.section
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="max-w-none mx-auto"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 px-7">
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
                    className="relative bg-gradient-to-br from-gray-950/70 to-black/70 border border-red-800/50 rounded-lg p-3 text-left overflow-hidden"
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

      {/* Tombol Aksi Terapung */}
      {/* Tombol Home */}
      <motion.button
        onClick={() => router.push("/")}
        whileHover={{ scale: 1.1, boxShadow: "0 0 15px rgba(239, 68, 68, 0.8)" }}
        whileTap={{ scale: 0.95 }}
        className="fixed top-1/2 -translate-y-1/2 left-4 z-50 bg-red-800 text-white p-3 border-2 border-red-600 rounded-full shadow-lg"
        aria-label={t("homeButton")}
      >
        <Home className="w-6 h-6" />
      </motion.button>

      {/* Tombol Play Again */}
      <motion.button
        onClick={handlePlayAgain}
        disabled={isCreatingNewSession}
        whileHover={{ scale: 1.1, boxShadow: "0 0 15px rgba(239, 68, 68, 0.8)" }}
        whileTap={{ scale: 0.95 }}
        className="fixed top-1/2 -translate-y-1/2 right-4 z-50 bg-red-800 text-white p-3 border-2 border-red-600 rounded-full shadow-lg disabled:opacity-50"
        aria-label={t("playAgain")}
      >
        {isCreatingNewSession ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <RotateCw className="w-6 h-6" />
          </motion.div>
        ) : (
          <RotateCw className="w-6 h-6" />
        )}
      </motion.button>

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
