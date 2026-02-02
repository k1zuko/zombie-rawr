"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { mysupa, supabase } from "@/lib/supabase"; // GANTI DARI supabase KE mysupa
import Background3 from "@/components/game/host/Background3";
import GameUI from "@/components/game/host/GameUI";
import { motion } from "framer-motion";
// import ZombieCharacter from "@/components/game/host/ZombieCharacter";
// import RunningCharacters from "@/components/game/host/RunningCharacters";
import OptimizedGameCanvas from "@/components/game/host/OptimizedGameCanvas";
import { useHostGuard } from "@/lib/host-guard";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import React from "react";
import { generateXID } from "@/lib/id-generator";
import LoadingScreen from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  StopCircle,
  Volume2,
  VolumeX,
} from "lucide-react";

import { calculateCountdown } from "@/lib/server-time";
import { AnimatePresence } from "framer-motion";

const ZOMBIE_MOBILE_VERTICAL_OFFSET = 90;
const ZOMBIE_MOBILE_HORIZONTAL_OFFSET = 20;

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
}

const MemoizedBackground3 = React.memo(Background3);
const MemoizedGameUI = React.memo(GameUI);

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
  countdown_started_at?: string | null;
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

      // const duration = p.finished_at && sess.started_at
      //   ? Math.floor((new Date(p.finished_at).getTime() - new Date(sess.started_at).getTime()) / 1000)
      //   : 0;

      return {
        id: p.id,
        user_id: p.user_id || null,
        nickname: p.nickname,
        character: p.character_type || "robot1",
        score: p.score || 0,
        correct: correctCount,
        completion: p.finished_at !== null,
        total_question: totalQuestions,
        current_question: p.answers?.length || 0,
        accuracy: accuracy.toFixed(2),
        started: sess.started_at,
        ended: p.finished_at
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

  const animationTimeRef = useRef(0);
  const [, forceRender] = useState(0);
  const [gameMode, setGameMode] = useState<"normal" | "panic">("normal");
  const [isClient, setIsClient] = useState(false);
  const [screenWidth, setScreenWidth] = useState(1200);
  const [screenHeight, setScreenHeight] = useState(800);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showEndGameDialog, setShowEndGameDialog] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const prevParticipants = usePrevious(participants);

  const lastAnswerTimesRef = useRef<{ [id: string]: number }>({});

  // playerStates is now derived via useMemo below (optimization)
  const [zombieState, setZombieState] = useState<ZombieState>({
    isAttacking: false,
    targetPlayerId: null,
    attackProgress: 0,
    basePosition: 500,
    currentPosition: 500,
  });

  const attackIntervalRef = useRef<NodeJS.Timeout | null>(null);



  useHostGuard(gamePin);

  // Manual End Game handler
  const handleEndGame = useCallback(async () => {
    if (!session) return;

    setShowEndGameDialog(false);
    setIsFinishing(true);

    const finishAt = new Date().toISOString();

    try {
      // 1) Mark all pending participants as finished
      const { data: pending } = await mysupa
        .from("participants")
        .select("*")
        .eq("session_id", session.id)
        .is("finished_at", null);

      if (Array.isArray(pending) && pending.length > 0) {
        await Promise.all(pending.map((p: any) => {
          const newHealth = { ...(p.health || {}), current: 0 };
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

      // 2) Update session status
      await mysupa
        .from("sessions")
        .update({ status: "finished", ended_at: finishAt })
        .eq("id", session.id);

      // 3) Sync and redirect
      await syncResultsToMainSupabase(session.id);
      router.push(`/host/${gamePin}/result`);
    } catch (err) {
      console.error("Error ending game:", err);
      router.push(`/host/${gamePin}/result`);
    }
  }, [session, router, gamePin]);

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

    // Set initial lastAnswerTimes based on session.started_at (game start time)
    // This ensures players get full 15 seconds from game start, not from join time
    const gameStartTime = sess.started_at ? new Date(sess.started_at).getTime() : Date.now();
    const initialTimes: { [id: string]: number } = {};
    (parts || []).forEach((p) => {
      initialTimes[p.id] = gameStartTime;
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
        // New participant - give them full 15 seconds from now
        newTimes[curr.id] = Date.now();
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

  // Optimized: Derive playerStates directly using useMemo (avoids double render)
  const playerStates = useMemo(() => {
    const states: { [id: string]: PlayerState } = {};
    participants.forEach((p, i) => {
      states[p.id] = {
        id: p.id,
        health: p.health.current,
        maxHealth: p.health.max,
        speed: p.health.speed || 20,
        position: i,
        attackIntensity: 0,
      };
    });
    return states;
  }, [participants]);

  // Audio Refs
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const eatingSfxRef = useRef<HTMLAudioElement | null>(null);
  const screamSfxRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false); // Default unmuted for game usually

  // Init mute state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("host_audio_enabled");
    if (stored !== null) {
      setIsMuted(stored !== 'true');
    }
  }, []);

  // COUNTDOWN STATE
  const [countdown, setCountdown] = useState<number | null>(null);

  // COUNTDOWN EFFECT
  useEffect(() => {
    if (!session?.countdown_started_at || session?.status === "active") {
      setCountdown(null);
      return;
    }

    const update = async () => {
      const remaining = calculateCountdown(session.countdown_started_at!, 10000);
      setCountdown(remaining);

      if (remaining <= 0) {
        // COUNTDOWN FINISHED -> Set Active
        setCountdown(null);

        // Optimistic update to prevent "blur" (LoadingScreen) flicker
        setSession((prev) => prev ? ({ ...prev, status: "active", started_at: new Date().toISOString() }) : null);

        await mysupa
          .from("sessions")
          .update({
            status: "active",
            countdown_started_at: null,
            started_at: new Date().toISOString()
          })
          .eq("id", session.id);
      }
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [session?.countdown_started_at, session?.status, session?.id]);

  // Play countdown sound
  useEffect(() => {
    if (session?.countdown_started_at && !isMuted && session.status !== 'active') {
      const remaining = calculateCountdown(session.countdown_started_at, 10000);
      if (remaining > 0) {
        const sfx = new Audio("/musics/countdown.mp3");
        sfx.volume = 0.5;
        sfx.play().catch(() => { });
      }
    }
  }, [session?.countdown_started_at, isMuted, session?.status]);

  // BGM Effect
  useEffect(() => {
    // Create Audio instance only once
    const bgm = new Audio("/musics/game.mp3");
    bgm.loop = true;
    bgm.volume = 0.3;
    bgm.autoplay = true;
    bgmRef.current = bgm;

    const eating = new Audio("/musics/eating.mp3");
    eatingSfxRef.current = eating;

    // Screams will be handled dynamically or preloaded? Let's just create ref

    // Play BGM if not muted
    if (!isMuted) {
      bgm.play().catch(e => console.log("BGM play failed:", e));
    }

    return () => {
      bgm.pause();
      bgm.currentTime = 0;
    };
  }, []);

  // Handle Mute Toggle
  useEffect(() => {
    if (bgmRef.current) {
      if (isMuted) {
        bgmRef.current.pause();
      } else {
        bgmRef.current.play().catch(e => console.log("BGM play failed:", e));
      }
    }
  }, [isMuted]);

  // Audio Helper
  const playSfx = useCallback((type: "attack" | "scream") => {
    if (isMuted) return;

    if (type === "attack") {
      if (eatingSfxRef.current) {
        eatingSfxRef.current.currentTime = 0;
        eatingSfxRef.current.play().catch(() => { });
      }
    } else if (type === "scream") {
      // Random scream 1-6
      const rand = Math.floor(Math.random() * 6) + 1;
      const scream = new Audio(`/musics/screaming-${rand}.mp3`);
      scream.volume = 0.6; // Slightly louder than BGM
      scream.play().catch(() => { });
    }
  }, [isMuted]);


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

        // PLAY SFX
        playSfx("attack");
        playSfx("scream");

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
  }, [participants, prevParticipants, zombieState.isAttacking, playSfx]);

  // Inactivity health drain
  useEffect(() => {
    if (!session || session.status !== "active") return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const toUpdate: Participant[] = [];
      const updatedTimes: { [id: string]: number } = {};

      // HITUNG DYNAMIC TIMER ----------------------------------------
      // 1. Base default fallback
      let limitSeconds = 15;

      const totalMinutes = session.total_time_minutes || 0;
      // Gunakan question_limit. Jika 0, fallback ke current_questions array length
      const qLimit = session.question_limit || (session as any).current_questions?.length || 0;

      // 2. Hitung base time per question
      if (totalMinutes > 0 && qLimit > 0) {
        const totalSeconds = totalMinutes * 60;
        limitSeconds = totalSeconds / qLimit;
      }

      // 3. Apply modifiers difficulty
      const diff = (session.difficulty || "").toLowerCase();
      if (diff.includes("easy")) {
        limitSeconds += 5;
      } else if (diff.includes("hard")) {
        limitSeconds -= 5;
      }

      // 4. Safety check (min 5 detik)
      if (limitSeconds < 5) limitSeconds = 5;

      const timeLimitMs = limitSeconds * 1000;
      // -------------------------------------------------------------

      participants.forEach((p) => {
        if (p.is_alive && p.health.current > 0 && !p.finished_at) {
          const lastTime = lastAnswerTimesRef.current[p.id];
          if (lastTime && now - lastTime > timeLimitMs) {
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
    }, 2000);

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
          setIsFinishing(true);
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
      setIsFinishing(true);
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
    if (session?.status === "finished" && !isFinishing) {
      router.push(`/host/${gamePin}/result`);
    }
  }, [session?.status, isFinishing, router, gamePin]);

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

  // Optimized animation using requestAnimationFrame
  useEffect(() => {
    let rafId: number;
    let lastTime = 0;
    const interval = gameMode === "panic" ? 30 : 100;

    const animate = (time: number) => {
      if (time - lastTime >= interval) {
        animationTimeRef.current += 1;
        lastTime = time;
        forceRender((p) => p + 1); // Only re-render when needed
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [gameMode]);

  // Optimized: Memoize activePlayers to prevent recalculation on every animation tick
  const activePlayers = useMemo(() =>
    participants.filter((p) => p.is_alive && p.health.current > 0 && !p.finished_at)
    , [participants]);
  const centerX = screenWidth / 2;
  const chaserType = session?.difficulty?.split(":")[0] as any || "zombie";

  // REMOVED early return to allow background render
  // if (!isClient || !session || !session.started_at || isFinishing) return <LoadingScreen ... />;

  const isLoading = !isClient || !session || !session.started_at || isFinishing;

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
    absolute right-4 top-3 z-50 hidden lg:block
  "
      >
        <Image
          src="/logo/gameforsmartlogo-horror.png"
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

      {/* Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black flex items-center justify-center z-[100]"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="text-[12rem] font-bold text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]"
            >
              {countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <LoadingScreen children={undefined} />
        </div>
      ) : (
        <>
          <OptimizedGameCanvas
            players={activePlayers}
            playerStates={playerStates}
            zombieState={zombieState}
            gameMode={gameMode}
            centerX={centerX}
            completedPlayers={[]}
            screenHeight={screenHeight}
            screenWidth={screenWidth}
            isPortraitMobile={isPortraitMobile || false}
            mobileHorizontalShift={isPortraitMobile ? 20 : 0}
            chaserType={chaserType}
          />

          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
            <MemoizedGameUI roomCode={gamePin} />
          </div>
        </>
      )}

      {/* Mute Button - Bottom Left */}
      <div className="absolute bottom-4 left-4 z-50">
        <Button
          variant="default"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className="bg-red-600 hover:bg-red-700 text-white border-2 border-white/20 rounded-full w-12 h-12 shadow-[0_0_20px_rgba(220,38,38,0.6)] hover:shadow-[0_0_30px_rgba(220,38,38,0.8)] hover:scale-110 transition-all duration-300"
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </Button>
      </div>

      {/* End Game Button */}
      <Button
        onClick={() => setShowEndGameDialog(true)}
        variant="destructive"
        size="sm"
        className="absolute bottom-4 right-4 z-50 bg-red-900/80 hover:bg-red-800 border border-red-700 shadow-lg"
      >
        <StopCircle className="w-4 h-4 mr-2" />
        {t("endGame") || "End Game"}
      </Button>

      {/* End Game Confirmation Dialog */}
      <Dialog open={showEndGameDialog} onOpenChange={setShowEndGameDialog}>
        <DialogContent className="bg-black/95 border-red-900/50 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 text-xl">
              {t("confirmEndGame") || "End Game?"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {t("confirmEndGameDesc") || "This will end the game for all players."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowEndGameDialog(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              {t("no") || "No"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleEndGame}
              className="bg-red-700 hover:bg-red-600"
            >
              {t("yes") || "Yes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
