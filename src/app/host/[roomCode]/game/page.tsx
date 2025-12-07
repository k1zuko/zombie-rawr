"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { mysupa, supabase } from "@/lib/supabase"; // GANTI DARI supabase KE mysupa
import Background3 from "@/components/game/host/Background3";
import GameUI from "@/components/game/host/GameUI";
import { motion } from "framer-motion";
import ZombieCharacter from "@/components/game/host/ZombieCharacter";
import RunningCharacters from "@/components/game/host/RunningCharacters";
import { useHostGuard } from "@/lib/host-guard";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import React from "react";
import { generateXID } from "@/lib/id-generator";

const ZOMBIE_MOBILE_VERTICAL_OFFSET = 90;
const ZOMBIE_MOBILE_HORIZONTAL_OFFSET = 20;

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
}

const MemoizedBackground3 = React.memo(Background3);
const MemoizedGameUI = React.memo(GameUI);
const MemoizedRunningCharacters = React.memo(RunningCharacters);
const MemoizedZombieCharacter = React.memo(ZombieCharacter);

export interface Participant {
  id: string;
  nickname: string;
  character_type: string;
  score: number;
  correct_answers: number;
  health: { max: number; current: number; speed: number };
  is_alive: boolean;
  joined_at: string;
  answers: any[];
  finished_at: string | null;
}

interface Session {
  id: string;
  game_pin: string;
  status: "waiting" | "active" | "finished";
  difficulty: string;
  question_limit: number;
  total_time_minutes: number;
  started_at: string | null;
}

interface PlayerState {
  id: string;
  health: number;
  maxHealth: number;
  speed: number;
  position: number;
  attackIntensity: number;
}

interface ZombieState {
  isAttacking: boolean;
  targetPlayerId: string | null;
  attackProgress: number;
  basePosition: number;
  currentPosition: number;
}

const syncResultsToMainSupabase = async (sessionId: string) => {
  try {
    // 1. Ambil session dari mysupa (QuizRush)
    const { data: sess, error: sessError } = await mysupa
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessError || !sess) {
      console.error("Session query error:", sessError);
      throw new Error("Session tidak ditemukan");
    }

    const totalQuestions = sess.question_limit || sess.current_questions.length;

    // 2. Ambil semua participant
    const { data: participants, error: partError } = await mysupa
      .from("participants")
      .select("id, user_id, nickname, character_type, score, correct_answers, answers, finished_at, health")
      .eq("session_id", sessionId);

    if (partError) {
      console.error("Participant query error:", partError);
    }

    if (!participants || participants.length === 0) return;

    // 3. Format participants (PERSIS SAMA KAYAK CRAZYRACE)
    const formattedParticipants = participants.map(p => {
      const correctCount = p.correct_answers || 0;
      const accuracy = totalQuestions > 0
        ? Number(((correctCount / totalQuestions) * 100).toFixed(2))
        : 0;

      const duration = p.finished_at && sess.started_at
        ? Math.floor((new Date(p.finished_at).getTime() - new Date(sess.started_at).getTime()) / 1000)
        : 0;

      return {
        id: p.id,
        user_id: p.user_id || null,
        nickname: p.nickname,
        character: p.character_type || "robot1",
        score: p.score || 0,
        correct: correctCount,
        completion: p.finished_at !== null,
        duration: duration,
        total_question: totalQuestions,
        current_question: p.answers?.length || 0,
        accuracy: accuracy.toFixed(2),
      };
    });

    // 4. Format responses (PERSIS SAMA KAYAK CRAZYRACE)
    const formattedResponses = participants
      .filter(p => (p.answers || []).length > 0)
      .map(p => ({
        id: generateXID(),
        participant: p.id,
        answers: p.answers || []
      }));

    console.log("Sync data:", {
      game_pin: sess.game_pin,
      started_at: sess.started_at,
      ended_at: sess.ended_at,
      totalQuestions,
      participantsCount: formattedParticipants.length
    });

    // 5. Kirim ke gameforsmart pake client supabase (bukan mysupa)
    const { error } = await supabase
      .from("game_sessions")
      .upsert({
        game_pin: sess.game_pin,
        quiz_id: sess.quiz_id,
        host_id: sess.host_id,
        status: "finished",
        application: "quizrush",
        total_time_minutes: sess.total_time_minutes || 5,
        question_limit: totalQuestions.toString(),
        started_at: sess.started_at,
        ended_at: sess.ended_at || new Date().toISOString(),
        participants: formattedParticipants,
        responses: formattedResponses,
        current_questions: sess.current_questions,
        quiz_detail: sess.quiz_detail,
        difficulty: sess.difficulty
      }, { onConflict: "game_pin" });

    if (error) throw error;

    console.log("QuizRush → gameforsmart: SUCCESS");
  } catch (err: any) {
    console.error("Gagal sync ke gameforsmart:", err.message);
  }
};

export default function HostGamePage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const gamePin = params.roomCode as string;

  const [animationTime, setAnimationTime] = useState(0);
  const [gameMode, setGameMode] = useState<"normal" | "panic">("normal");
  const [isClient, setIsClient] = useState(false);
  const [screenWidth, setScreenWidth] = useState(1200);
  const [screenHeight, setScreenHeight] = useState(800);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const prevParticipants = usePrevious(participants);

  const [playerStates, setPlayerStates] = useState<{ [id: string]: PlayerState }>({});
  const [zombieState, setZombieState] = useState<ZombieState>({
    isAttacking: false,
    targetPlayerId: null,
    attackProgress: 0,
    basePosition: 500,
    currentPosition: 500,
  });

  const attackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useHostGuard(gamePin);

  // Fetch session + participants
  const fetchData = useCallback(async () => {
    if (!gamePin) return;

    const { data: sess, error: sessErr } = await mysupa
      .from("sessions")
      .select("*")
      .eq("game_pin", gamePin.toUpperCase())
      .single();

    if (sessErr || !sess) {
      router.replace("/");
      return;
    }

    setSession(sess);

    const { data: parts } = await mysupa
      .from("participants")
      .select("*")
      .eq("session_id", sess.id)
      .order("joined_at", { ascending: true });

    setParticipants(parts || []);
  }, [gamePin, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!session?.id) return;

    const channel = mysupa
      .channel(`host-${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${session.id}` },
        (p) => setSession(p.new as Session)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${session.id}` },
        (p) => {
          const updated = p.new as Participant;
          setParticipants((prev) =>
            prev.some((x) => x.id === updated.id)
              ? prev.map((x) => (x.id === updated.id ? updated : x))
              : [...prev, updated]
          );
        }
      )
      .subscribe();

    return () => { mysupa.removeChannel(channel); };
  }, [session?.id]);

  // Update playerStates
  useEffect(() => {
    const states: { [id: string]: PlayerState } = {};
    participants.forEach((p, i) => {
      states[p.id] = {
        id: p.id,
        health: p.health.current,
        maxHealth: p.health.max,
        speed: p.health.speed,
        position: i,
        attackIntensity: 0,
      };
    });
    setPlayerStates(states);
  }, [participants]);

  // Zombie attack ketika health turun
  useEffect(() => {
    if (!prevParticipants) return;

    participants.forEach((curr) => {
      const prev = prevParticipants.find((p) => p.id === curr.id);
      if (
        prev &&
        curr.health.current < prev.health.current &&
        curr.is_alive &&
        !zombieState.isAttacking
      ) {
        setZombieState({ isAttacking: true, targetPlayerId: curr.id, attackProgress: 0, basePosition: 500, currentPosition: 500 });
        setGameMode("panic");

        let progress = 0;
        if (attackIntervalRef.current) clearInterval(attackIntervalRef.current);
        attackIntervalRef.current = setInterval(() => {
          progress += 0.033;
          setZombieState((s) => ({
            ...s,
            attackProgress: progress,
            currentPosition: s.basePosition * (1 - progress * 0.8),
          }));
          if (progress >= 1) {
            clearInterval(attackIntervalRef.current!);
            setZombieState({ isAttacking: false, targetPlayerId: null, attackProgress: 0, basePosition: 500, currentPosition: 500 });
            setGameMode("normal");
          }
        }, 30);
      }
    });
  }, [participants, prevParticipants, zombieState.isAttacking]);

  // Auto finish game
  useEffect(() => {
    if (!session || session.status === "finished") return;

    // Cek: semua player sudah tidak hidup ATAU sudah selesai (finished_at ada)
    const allFinishedOrDead = participants.length > 0 && participants.every((p) => {
      // Player dianggap "selesai" jika: health habis (is_alive false) ATAU sudah submit jawaban akhir (finished_at ada)
      return !p.is_alive || p.finished_at !== null;
    });

    if (allFinishedOrDead) {
      // LANGSUNG UPDATE STATUS + REDIRECT HOST
      const finishAndSync = async () => {
        try {
          // 1. Update status di QuizRush (mysupa)
          await mysupa
            .from("sessions")
            .update({
              status: "finished",
              ended_at: new Date().toISOString()
            })
            .eq("id", session.id);

          // 2. Sync ke gameforsmart (supabase client)
          await syncResultsToMainSupabase(session.id);

          // 3. Redirect host
          router.push(`/host/${gamePin}/result`);
        } catch (err) {
          console.error("Gagal finish game:", err);
          // Tetap redirect biar host gak stuck
          router.push(`/host/${gamePin}/result`);
        }
      }
      finishAndSync();
    }
  }, [participants, session, router, gamePin]);

  // Redirect jika game selesai
  useEffect(() => {
    if (session?.status === "finished") {
      router.push(`/host/${gamePin}/result`);
    }
  }, [session?.status, router, gamePin]);

  // Screen resize
  useEffect(() => {
    setIsClient(true);
    const handle = () => {
      setScreenWidth(window.innerWidth);
      setScreenHeight(window.innerHeight);
      setIsPortraitMobile(window.innerWidth <= 768 && window.matchMedia("(orientation: portrait)").matches);
    };
    handle();
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", handle);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("orientationchange", handle);
    };
  }, []);

  useEffect(() => {
    const i = setInterval(() => setAnimationTime((p) => p + 1), gameMode === "panic" ? 30 : 100);
    return () => clearInterval(i);
  }, [gameMode]);

  const activePlayers = participants.filter((p) => p.is_alive && p.health.current > 0 && !p.finished_at);
  const centerX = screenWidth / 2;
  const chaserType = session?.difficulty?.split(":")[0] as any || "zombie";

  if (!isClient || !session) {
    return (
      <div className="w-full h-screen bg-black flex-center text-white text-xl">
        {t("loading")}
      </div>
    );
  }

  const mainContentClass = `relative w-full h-screen bg-black overflow-hidden ${isPortraitMobile ? 'rotate-to-landscape-wrapper' : ''}`;
  const wrapperStyle = isPortraitMobile ? {
    width: `${screenHeight}px`,
    height: `${screenWidth}px`,
  } : {};

  return (
    <div className={mainContentClass} style={wrapperStyle}>
      <MemoizedBackground3 isFlashing={false} />
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
        className="flex flex-col gap-3 mb-10 px-4"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-5xl font-bold font-mono text-red-500 drop-shadow-lg">{t("title")}</h1>
          <Image src="/logo/gameforsmartlogo-horror.png" alt="logo" width={254} height={80} />
        </div>
      </motion.header>

      <MemoizedRunningCharacters
        players={activePlayers}
        playerStates={playerStates}
        zombieState={zombieState}
        animationTime={animationTime}
        gameMode={gameMode}
        centerX={centerX}
        completedPlayers={[]}
      />

      <MemoizedZombieCharacter
        zombieState={zombieState}
        gameMode={gameMode}
        centerX={centerX}
        chaserType={chaserType}
        players={activePlayers}
        animationTime={animationTime}
        screenHeight={screenHeight}
        isPortraitMobile={isPortraitMobile}
        mobileHorizontalShift={ZOMBIE_MOBILE_HORIZONTAL_OFFSET}
      />

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <MemoizedGameUI roomCode={gamePin} />
      </div>
    </div>
  );
}