"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { mysupa, supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Confetti from "react-confetti";
import { Home, RotateCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useHostGuard } from "@/lib/host-guard";
import { generateGamePin } from "@/utils/gameHelpers";
import LoadingScreen from "@/components/LoadingScreen";

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
  survivalSeconds: number;
}

export default function ResultsHostPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [showLoading, setShowLoading] = useState(false);
  const [isCreatingNewSession, setIsCreatingNewSession] = useState(false);

  useHostGuard(roomCode);

  const getCharacterByType = useCallback((type: string) => {
    return characterGifs.find((char) => char.type === type) || characterGifs[0];
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const fetchGameData = useCallback(async () => {
    if (!roomCode) return;

    try {
      setIsLoading(true);

      const { data: session, error: sessErr } = await mysupa
        .from("sessions")
        .select("id, quiz_id, question_limit, started_at")
        .eq("game_pin", roomCode.toUpperCase())
        .single();

      if (sessErr || !session) throw new Error("Session tidak ditemukan");

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

        return {
          id: p.id,
          nickname: p.nickname,
          character_type: p.character_type || "robot1",
          rank: index + 1,
          duration: formatDuration(survival),
          isLolos: p.health?.current > 0 && p.finished_at !== null,
          correctAnswers: p.correct_answers || 0,
          totalQuestions,
          finalScore: p.score || 0,
          finalHealth: p.health?.current || 0,
          survivalSeconds: survival,
        };
      });

      setPlayerResults(results);

      if (results.length > 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      setLoadingError("Gagal memuat hasil");
      setIsLoading(false);
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

  const handleNavigateHome = () => {
    setShowLoading(true);
    router.push("/");
  };

  const handlePlayAgain = async () => {
    if (!roomCode) return;
    setIsCreatingNewSession(true);
    setShowLoading(true);

    try {
      const { data: oldSess } = await mysupa
        .from("sessions")
        .select("quiz_id, host_id, question_limit, total_time_minutes, difficulty, current_questions")
        .eq("game_pin", roomCode.toUpperCase())
        .single();

      if (!oldSess) throw new Error("Sesi lama tidak ditemukan");

      const questions = oldSess.current_questions || [];
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      const selectedQuestions = shuffled.slice(0, oldSess.question_limit || 5);

      const newPin = generateGamePin(6);

      await mysupa.from("sessions").insert({
        game_pin: newPin,
        quiz_id: oldSess.quiz_id,
        host_id: oldSess.host_id,
        status: "waiting",
        question_limit: oldSess.question_limit,
        total_time_minutes: oldSess.total_time_minutes,
        difficulty: oldSess.difficulty,
        current_questions: selectedQuestions,
      });

      await supabase.from("game_sessions").insert({
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

      router.push(`/host/${newPin}/lobby`);
    } catch (err: any) {
      console.error("Gagal restart:", err);
      alert("Gagal membuat permainan baru: " + err.message);
      setIsCreatingNewSession(false);
      setShowLoading(false);
    }
  };

  const topPlayers = playerResults.slice(0, 3);
  const others = playerResults.slice(3);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1: return { text: "text-yellow-400 glow-gold" };
      case 2: return { text: "text-gray-300 glow-silver" };
      case 3: return { text: "text-amber-600 glow-bronze" };
      default: return { text: "text-red-400 glow-red" };
    }
  };

  if (isLoading) return <LoadingScreen children={undefined} />;
  if (loadingError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-950 flex items-center justify-center">
        <div className="text-red-500 text-2xl text-center p-8">{loadingError}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* === LAYER BACKGROUND (dengan brightness terpisah) === */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/background/10.gif')",
          filter: "brightness(0.65)",
        }}
      />

      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_10%,rgba(139,0,0,0.12),transparent_70%)]" />

      {/* === KONTEN UTAMA === */}
      <div className="relative z-10 min-h-screen">
        {/* Header logo */}
        <div className="flex items-center justify-between ml-4 mr-4 mt-4 md:ml-8 md:mr-8 md:mt-5">
          <Image
            src="/logo/quizrush.png"
            alt="QuizRush Logo"
            width={80}
            height={80}
            className="w-34 sm:w-28 md:w-72 h-auto"
            unoptimized
            onClick={() => router.push("/")}
          />
          <img
            src="/logo/gameforsmartlogo-horror.png"
            alt="GameForSmart Logo"
            width={80}
            height={80}
            className="w-34 sm:w-28 md:w-72 h-auto"
          />
        </div>

        <AnimatePresence>
          {showConfetti && (
            <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={250} />
          )}
        </AnimatePresence>

        <div className="container mx-auto px-3 py-5 md:py-8 max-w-5xl">
          {/* Judul Leaderboard */}
          <div className="text-center mb-6 md:mb-9">
            <motion.h1
              initial={{ opacity: 0, y: -25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="hidden md:block text-4xl md:text-5xl font-black tracking-wide text-red-600"
              style={{
                textShadow: `
                  -2px -2px 0 #000,
                   2px -2px 0 #000,
                  -2px  2px 0 #000,
                   2px  2px 0 #000,
                   0 0 14px rgba(220,38,38,0.85)
                `,
              }}
            >
              Leaderboard
            </motion.h1>
          </div>

          {/* Podium Desktop */}
          {playerResults.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xl md:text-2xl">
              Belum ada pemain yang menyelesaikan permainan
            </div>
          ) : (
            <motion.div
              className="hidden md:flex justify-center items-end gap-3 sm:gap-5 mb-6 sm:mb-10 h-[280px] lg:h-[340px] relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              {/* Posisi 2 - hanya jika ada minimal 2 pemain */}
              {playerResults.length >= 2 && (
                <PodiumPosition
                  rank={2}
                  player={topPlayers[1]}
                  height="h-[280px] lg:h-[340px]"
                  width="w-36 lg:w-44"
                  getCharacterByType={getCharacterByType}
                  getRankStyle={getRankStyle}
                />
              )}

              {/* Posisi 1 - selalu tampil jika ada minimal 1 pemain */}
              {playerResults.length >= 1 && (
                <PodiumPosition
                  rank={1}
                  player={topPlayers[0]}
                  height="h-[400px] lg:h-[400px]"
                  width="w-44 lg:w-52"
                  getCharacterByType={getCharacterByType}
                  getRankStyle={getRankStyle}
                  isFirst={true}
                />
              )}

              {/* Posisi 3 - hanya jika ada minimal 3 pemain */}
              {playerResults.length >= 3 && (
                <PodiumPosition
                  rank={3}
                  player={topPlayers[2]}
                  height="h-[280px] lg:h-[340px]"
                  width="w-36 lg:w-44"
                  getCharacterByType={getCharacterByType}
                  getRankStyle={getRankStyle}
                />
              )}
            </motion.div>
          )}

          {/* Mobile Leaderboard */}
          <div className="md:hidden space-y-2.5 mt-6 px-2">
            {playerResults.length === 0 ? (
              <div className="text-center text-gray-500 py-10">Belum ada pemain</div>
            ) : (
              playerResults.map((player, index) => {
                const rank = index + 1;
                const style = getRankStyle(rank);

                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${
                      rank <= 3 ? 'bg-red-950/25 border-red-600/40' : 'bg-black/35 border-gray-700'
                    }`}
                  >
                    <div className="text-red-400 font-bold text-base shrink-0">#{rank}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{player.nickname}</p>
                    </div>
                    <div className={`font-bold ${style.text} text-lg`}>{player.finalScore}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tabel lainnya (desktop) */}
          {others.length > 0 && (
            <motion.div
              className="hidden md:block mt-8 max-w-3xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <div className="bg-black/45 rounded-lg overflow-hidden border border-red-900/30 text-sm">
                <table className="w-full text-left">
                  <thead className="bg-red-950/40">
                    <tr>
                      <th className="py-2.5 px-4 text-red-300 font-semibold">Rank</th>
                      <th className="py-2.5 px-4 text-red-300 font-semibold">Player</th>
                      <th className="py-2.5 px-4 text-red-300 font-semibold">Score</th>
                      <th className="py-2.5 px-4 text-red-300 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {others.map((player, idx) => {
                      const rank = idx + 4;
                      const char = getCharacterByType(player.character_type);
                      const style = getRankStyle(rank);

                      return (
                        <tr key={player.id} className="border-t border-red-900/20 hover:bg-red-950/20 transition-colors">
                          <td className={`py-2.5 px-4 font-black ${style.text}`}>#{rank}</td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full overflow-hidden">
                                <img src={char.src} alt="" className="w-full h-full object-cover" />
                              </div>
                              <span className="font-medium text-white">{player.nickname}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-red-400">{player.finalScore}</td>
                          <td className="py-2.5 px-4 text-gray-400">{player.duration}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Tombol Mobile */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/65 backdrop-blur-md border-t border-red-900/40 py-3 flex justify-center gap-5">
            <button
              onClick={handleNavigateHome}
              disabled={showLoading}
              className="bg-red-800/75 border border-red-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-red-900/70 transition disabled:opacity-50 flex items-center gap-1.5 text-sm"
            >
              <Home size={18} />
            </button>
            <button
              onClick={handlePlayAgain}
              disabled={isCreatingNewSession || showLoading}
              className="bg-red-800/75 border border-red-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-red-700/75 transition disabled:opacity-50 flex items-center gap-1.5 text-sm"
            >
              {isCreatingNewSession ? <RotateCw className="animate-spin" size={18} /> : <RotateCw size={18} />}
            </button>
          </div>

          {/* Tombol Desktop */}
          <motion.div
            className="hidden md:flex fixed mx-6 inset-y-0 left-0 right-0 justify-between items-center pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.8 }}
          >
            <button
              onClick={handleNavigateHome}
              className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full bg-red-950/65 border border-red-700 text-red-300 hover:bg-red-900/70 transition-all shadow-md"
            >
              <Home size={20} />
            </button>
            <button
              onClick={handlePlayAgain}
              disabled={isCreatingNewSession}
              className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full bg-red-800/75 border border-red-600 text-white hover:bg-red-700/75 transition-all shadow-md disabled:opacity-50"
            >
              {isCreatingNewSession ? <RotateCw className="animate-spin" size={20} /> : <RotateCw size={20} />}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PodiumPosition({
  rank,
  player,
  height,
  width,
  getCharacterByType,
  getRankStyle,
  isFirst = false,
}: {
  rank: number;
  player: PlayerResult;
  height: string;
  width: string;
  getCharacterByType: (t: string) => any;
  getRankStyle: (r: number) => any;
  isFirst?: boolean;
}) {
  const char = getCharacterByType(player.character_type);
  const style = getRankStyle(rank);

  return (
    <motion.div
      className={`flex flex-col justify-end ${height} ${width} relative`}
      initial={{ scale: 0.85, y: 40 }}
      animate={{ scale: isFirst ? 1.08 : 1, y: 0 }}
      transition={{ delay: (rank - 1) * 0.08 + 0.25, duration: 0.7 }}
    >
      <Card className={`p-2.5 lg:p-4 text-center bg-black/65 border border-red-900/40 min-h-[120px] lg:min-h-[150px] flex flex-col justify-center ${isFirst ? 'min-h-[140px] lg:min-h-[170px]' : ''}`}>
        <div className={`text-xl lg:text-2xl font-black mb-1 ${style.text} ${isFirst ? 'text-2xl lg:text-3xl mb-1.5' : ''}`}>
          #{rank}
        </div>

        <div className="mb-3">
          <div className={`w-16 h-16 lg:w-24 lg:h-24 mx-auto overflow-hidden ${isFirst ? 'w-20 lg:w-28' : ''}`}>
            <img
              src={char.src}
              alt={char.alt}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <h3 className={`font-bold text-white text-sm lg:text-base break-words line-clamp-2 ${isFirst ? 'text-base lg:text-lg mb-1' : 'mb-0.5'}`}>
          {player.nickname}
        </h3>

        <div className={`font-bold text-red-400 ${isFirst ? 'text-xl lg:text-2xl' : 'text-lg lg:text-xl'}`}>
          {player.finalScore}
        </div>
      </Card>
    </motion.div>
  );
}