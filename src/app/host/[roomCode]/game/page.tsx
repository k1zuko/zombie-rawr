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
import LoadingScreen from "@/components/LoadingScreen";

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

  const lastAnswerTimesRef = useRef<{ [id: string]: number }>({});

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

    // Set initial lastAnswerTimes based on joined_at
    const initialTimes: { [id: string]: number } = {};
    (parts || []).forEach((p) => {
      initialTimes[p.id] = new Date(p.joined_at).getTime();
    });
    lastAnswerTimesRef.current = initialTimes;
  }, [gamePin, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Update lastAnswerTimes when participants change
  useEffect(() => {
    if (!prevParticipants) {
      // Initial set already handled in fetchData
      return;
    }

    const newTimes: { [id: string]: number } = { ...lastAnswerTimesRef.current };

    participants.forEach((curr) => {
      const prevPart = prevParticipants.find((p) => p.id === curr.id);
      if (!prevPart) {
        // New participant
        newTimes[curr.id] = new Date(curr.joined_at).getTime();
      } else {
        const prevLen = (prevPart.answers || []).length;
        const currLen = (curr.answers || []).length;
        if (currLen > prevLen) {
          // Answers increased (activity)
          newTimes[curr.id] = Date.now();
        }
        // Else, keep existing time
      }
    });

    lastAnswerTimesRef.current = newTimes;
  }, [participants, prevParticipants]);

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

  // Inactivity health drain
  useEffect(() => {
    if (!session || session.status !== "active") return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const toUpdate: Participant[] = [];
      const updatedTimes: { [id: string]: number } = {};

      participants.forEach((p) => {
        if (p.is_alive && p.health.current > 0 && !p.finished_at) {
          const lastTime = lastAnswerTimesRef.current[p.id];
          if (lastTime && now - lastTime > 15000) {
            toUpdate.push(p);
            // Reset timer after drain
            updatedTimes[p.id] = now;
          }
        }
      });

      if (toUpdate.length > 0) {
        await Promise.all(
          toUpdate.map(async (p) => {
            const decreaseAmount = 1;
            const newCurrent = Math.max(0, p.health.current - decreaseAmount);
            const updates: any = {
              health: {
                ...p.health,
                current: newCurrent,
              },
            };

            if (newCurrent <= 0) {
              updates.is_alive = false;
              updates.finished_at = new Date().toISOString();
            }

            const { error } = await mysupa
              .from("participants")
              .update(updates)
              .eq("id", p.id);

            if (error) {
              console.error("Error updating inactive player health:", error);
            }
          })
        );

        // Update local lastAnswerTimes after successful drain
        lastAnswerTimesRef.current = { ...lastAnswerTimesRef.current, ...updatedTimes };
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [participants, session]);

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

  // Finish session when timer expires (based on session.started_at + total_time_minutes)
  useEffect(() => {
    if (!session || session.status === "finished" || !session.started_at) return;

    const totalMinutes = session.total_time_minutes || 0;
    if (totalMinutes <= 0) return;

    const endTime = new Date(session.started_at).getTime() + totalMinutes * 60 * 1000;
    const now = Date.now();
    const msLeft = endTime - now;

    let timer: NodeJS.Timeout | null = null;

    const doFinish = async () => {
      const finishAt = new Date().toISOString();
      try {
        // 1) fetch participants who haven't finished yet
        const { data: pending, error: pendingErr } = await mysupa
          .from("participants")
          .select("*")
          .eq("session_id", session.id)
          .is("finished_at", null);

        if (pendingErr) console.error("Error fetching pending participants:", pendingErr);

        // 2) mark each pending participant as finished (is_alive false, finished_at, completion true, health.current = 0)
        if (Array.isArray(pending) && pending.length > 0) {
          await Promise.all(pending.map((p: any) => {
            const newHealth = {
              ...(p.health || {}),
              current: 0
            };
            return mysupa
              .from("participants")
              .update({
                finished_at: finishAt,
                completion: true,
                is_alive: false,
                health: newHealth
              })
              .eq("id", p.id);
          }));
        }

        // 3) update session status to finished
        await mysupa
          .from("sessions")
          .update({ status: "finished", ended_at: finishAt })
          .eq("id", session.id);

        // 4) sync to main supabase and redirect host
        await syncResultsToMainSupabase(session.id);
        router.push(`/host/${gamePin}/result`);
      } catch (err) {
        console.error("Error finishing session on timeout:", err);
        // still redirect to result to avoid host stuck
        router.push(`/host/${gamePin}/result`);
      }
    };

    if (msLeft <= 0) {
      // already passed end time — finish immediately
      doFinish();
    } else {
      timer = setTimeout(() => doFinish(), msLeft);
    }

    return () => { if (timer) clearTimeout(timer); };
  }, [session, router, gamePin]);

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
      <LoadingScreen children={undefined} />
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

{/* QuizRush Logo - Top Left */}
<div className="absolute top-4 left-4 z-50 hidden lg:block">
  <Image
    src="/logo/quizrush.png"
    alt="QuizRush Logo"
    width={200}
    height={50}
    className="h-auto w-32 md:w-48 lg:w-64"
    unoptimized
  />
</div>


<div
  className="
    absolute right-4 z-50 hidden lg:block
    md:top-10        /* tablet */
    lg:-top-8        /* desktop ≈ mt-3 */
  "
>
  <Image
    src="/logo/gameforsmartlogo.png"
    alt="GameForSmart Logo"
    width={200}
    height={50}
    className="h-auto w-32 md:w-48 lg:w-88"
    unoptimized
  />
</div>



      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
        className="flex flex-col gap-3 mb-10 px-4"
      >

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