"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Background3 from "@/components/game/host/Background3";
import GameUI from "@/components/game/host/GameUI";
import { motion } from "framer-motion"; // Hapus AnimatePresence jika tidak dipakai
import ZombieCharacter from "@/components/game/host/ZombieCharacter";
import RunningCharacters from "@/components/game/host/RunningCharacters";
import { useHostGuard } from "@/lib/host-guard";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import { throttle } from "lodash"; // ✅ Tambahkan throttle
import React from "react";

// Memoisasi komponen statis
const MemoizedBackground3 = React.memo(Background3);
const MemoizedGameUI = React.memo(GameUI);

interface Player {
  id: string;
  nickname: string;
  character_type: string;
  score: number;
  is_alive: boolean;
  joined_at: string;
}

interface GameRoom {
  id: string;
  room_code: string;
  title: string;
  status: string;
  max_players: number;
  current_phase: string;
  chaser_type: "zombie" | "monster1" | "monster2" | "monster3" | "darknight";
  countdown_start?: string;
  difficulty_level: string;
}

interface PlayerHealthState {
  id: string;
  player_id: string;
  room_id: string;
  health: number;
  max_health: number;
  speed: number;
  is_being_attacked: boolean;
  last_attack_time: string;
  last_answer_time: string;
}

interface PlayerState {
  id: string;
  health: number;
  maxHealth: number;
  speed: number;
  isBeingAttacked: boolean;
  position: number;
  lastAttackTime: number;
  attackIntensity: number;
  countdown?: number;
}

interface ZombieState {
  isAttacking: boolean;
  targetPlayerId: string | null;
  attackProgress: number;
  basePosition: number;
  currentPosition: number;
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
}

export default function HostGamePage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [animationTime, setAnimationTime] = useState(0);
  const [gameMode, setGameMode] = useState<"normal" | "panic">("normal");
  const [isClient, setIsClient] = useState(false);
  const [screenWidth, setScreenWidth] = useState(1200);
  const [imageLoadStatus, setImageLoadStatus] = useState<{ [key: string]: boolean }>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [chaserType, setChaserType] = useState<"zombie" | "monster1" | "monster2" | "monster3" | "darknight">("zombie");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [completedPlayers, setCompletedPlayers] = useState<Player[]>([]);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [playerStates, setPlayerStates] = useState<{ [playerId: string]: PlayerState }>({});
  const [playerHealthStates, setPlayerHealthStates] = useState<{ [playerId: string]: PlayerHealthState }>({});
  const [zombieState, setZombieState] = useState<ZombieState>({
    isAttacking: false,
    targetPlayerId: null,
    attackProgress: 0,
    basePosition: 500,
    currentPosition: 500,
  });
  const [attackQueue, setAttackQueue] = useState<string[]>([]);
  const [backgroundFlash, setBackgroundFlash] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const attackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  useHostGuard(roomCode);

  // Definisikan pengaturan berdasarkan difficulty_level
  const difficultySettings = {
    easy: { zombieAttackCountdown: 25},
    medium: { zombieAttackCountdown: 10 },
    hard: { zombieAttackCountdown: 5 },
  };
  const zombieAttackCountdown = gameRoom && ["easy", "medium", "hard"].includes(gameRoom.difficulty_level)
    ? difficultySettings[gameRoom.difficulty_level as keyof typeof difficultySettings].zombieAttackCountdown
    : difficultySettings.medium.zombieAttackCountdown;

  // Initialize player states
  const initializePlayerStates = useCallback(
    (playersData: Player[], healthData: PlayerHealthState[]) => {
      const newStates: { [playerId: string]: PlayerState } = {};
      const newHealthStates: { [playerId: string]: PlayerHealthState } = {};

      playersData.forEach((player, index) => {
        const healthState = healthData.find((h) => h.player_id === player.id);
        const currentHealth = healthState?.health ?? 3;
        const currentMaxHealth = healthState?.max_health ?? 3;
        const currentSpeed = healthState?.speed ?? 20;
        const isBeingAttacked = healthState?.is_being_attacked ?? false;
        const lastAttackTime = healthState ? new Date(healthState.last_attack_time).getTime() : 0;

        newStates[player.id] = {
          id: player.id,
          health: currentHealth,
          maxHealth: currentMaxHealth,
          speed: currentSpeed,
          isBeingAttacked,
          position: index,
          lastAttackTime,
          attackIntensity: 0,
          countdown:
            currentSpeed <= 30 && !isBeingAttacked && currentHealth > 0 && player.is_alive
              ? zombieAttackCountdown
              : undefined,
        };

        if (healthState) {
          newHealthStates[player.id] = healthState;
        }
      });

      setPlayerStates(newStates);
      setPlayerHealthStates(newHealthStates);
    },
    [zombieAttackCountdown]
  );

  // Centralized function to update player state
  const updatePlayerState = useCallback(
    async (playerId: string, updates: Partial<PlayerHealthState>, localUpdates: Partial<PlayerState> = {}) => {
      if (!gameRoom) return;

      try {
        const { error } = await supabase
          .from("player_health_states")
          .update({ ...updates, last_attack_time: new Date().toISOString() })
          .eq("player_id", playerId)
          .eq("room_id", gameRoom.id);

        if (error) {
          console.error(t("log.updatePlayerStateError", { playerId, error: error.message }));
          return;
        }

        setPlayerStates((prev) => {
          const current = prev[playerId] || {};
          return {
            ...prev,
            [playerId]: {
              ...current,
              ...localUpdates,
              health: updates.health ?? current.health,
              speed: updates.speed ?? current.speed,
              isBeingAttacked: updates.is_being_attacked ?? current.isBeingAttacked,
              lastAttackTime: Date.now(),
            },
          };
        });
      } catch (error) {
        console.error(t("log.updatePlayerStateError", { playerId, error }));
      }
    },
    [gameRoom, t]
  );

  // Handle chaser attack
  const handleZombieAttack = useCallback(
    (playerId: string, newHealth: number, newSpeed: number) => {
      const playerState = playerStates[playerId];
      const player = players.find((p) => p.id === playerId);
      if (!playerState || !player || newHealth < 0 || !player.is_alive) {
        setAttackQueue((prev) => prev.filter((id) => id !== playerId));
        return;
      }

      if (zombieState.isAttacking && zombieState.targetPlayerId !== playerId) {
        setAttackQueue((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
        return;
      }

      if (attackIntervalRef.current) {
        clearInterval(attackIntervalRef.current);
        attackIntervalRef.current = null;
      }

      setZombieState({
        isAttacking: true,
        targetPlayerId: playerId,
        attackProgress: 0,
        basePosition: 500,
        currentPosition: 500,
      });

      setBackgroundFlash(true);
      setGameMode("panic");

      const finalSpeed = Math.max(20, newSpeed - 5);

      updatePlayerState(
        playerId,
        {
          health: newHealth,
          speed: finalSpeed,
          is_being_attacked: true,
        },
        {
          isBeingAttacked: true,
          attackIntensity: 0.5,
          countdown: undefined,
        }
      );

      let progress = 0;
      attackIntervalRef.current = setInterval(() => {
        progress += 0.0333;
        setZombieState((prev) => ({
          ...prev,
          attackProgress: progress,
          currentPosition: prev.basePosition * (1 - progress * 0.8),
        }));

        if (progress >= 1) {
          clearInterval(attackIntervalRef.current!);
          attackIntervalRef.current = null;

          setZombieState({
            isAttacking: false,
            targetPlayerId: null,
            attackProgress: 0,
            basePosition: 500,
            currentPosition: 500,
          });

          updatePlayerState(
            playerId,
            {
              is_being_attacked: false,
            },
            {
              isBeingAttacked: false,
              attackIntensity: 0,
              countdown: finalSpeed <= 30 && newHealth > 0 && player.is_alive ? zombieAttackCountdown : undefined,
            }
          );

          setBackgroundFlash(false);
          setGameMode("normal");

          setAttackQueue((prev) => {
            const nextQueue = prev.filter((id) => id !== playerId);
            if (nextQueue.length > 0) {
              const nextPlayerId = nextQueue[0];
              const nextState = playerStates[nextPlayerId];
              const nextPlayer = players.find((p) => p.id === nextPlayerId);
              if (nextState && nextState.speed <= 30 && nextState.health > 0 && nextPlayer?.is_alive) {
                setTimeout(() => {
                  handleZombieAttack(nextPlayerId, nextState.health - 1, nextState.speed);
                }, 500);
              }
            }
            return nextQueue;
          });
        }
      }, 30);
    },
    [playerStates, players, updatePlayerState, zombieState, zombieAttackCountdown, t]
  );

  useEffect(() => {
    if (!gameRoom?.countdown_start || countdown !== null) return;

    const countdownStartTime = new Date(gameRoom.countdown_start).getTime();
    const countdownDuration = 10000;

    const updateCountdown = () => {
      const now = Date.now();
      const elapsed = now - countdownStartTime;
      const remaining = Math.max(0, Math.ceil((countdownDuration - elapsed) / 1000));
      setCountdown(remaining);

      if (remaining <= 0) {
        setCountdown(null);
        setIsStarting(false);
        return false;
      }
      return true;
    };

    if (updateCountdown()) {
      const timer = setInterval(() => {
        if (!updateCountdown()) {
          clearInterval(timer);
        }
      }, 100);

      return () => clearInterval(timer);
    } else {
      setCountdown(null);
      setIsStarting(false);
    }
  }, [gameRoom?.countdown_start, t]);

  // Handle correct answer — asli, untuk throttle
  const handleCorrectAnswer = useCallback(
    (playerId: string) => {
      const playerState = playerStates[playerId];
      if (!playerState) return;

      const newSpeed = Math.min(playerState.speed + 5, 90);
      const shouldResetCountdown = newSpeed <= 30;

      updatePlayerState(
        playerId,
        {
          speed: newSpeed,
          is_being_attacked: false,
          last_answer_time: new Date().toISOString(),
        },
        {
          speed: newSpeed,
          isBeingAttacked: false,
          countdown: shouldResetCountdown ? zombieAttackCountdown : undefined,
        }
      );

      if (zombieState.targetPlayerId === playerId && zombieState.isAttacking) {
        clearInterval(attackIntervalRef.current!);
        attackIntervalRef.current = null;
        setZombieState({
          isAttacking: false,
          targetPlayerId: null,
          attackProgress: 0,
          basePosition: 500,
          currentPosition: 500,
        });
        setBackgroundFlash(false);
        setGameMode("normal");
      }

      setAttackQueue((prev) => prev.filter((id) => id !== playerId));
    },
    [playerStates, zombieState, updatePlayerState, zombieAttackCountdown, t]
  );

  // Handle wrong answer — asli, untuk throttle
  const handleWrongAnswer = useCallback(
    (playerId: string) => {
      const playerState = playerStates[playerId];
      if (!playerState) return;

      const newSpeed = Math.max(20, playerState.speed - 5);
      const shouldStartCountdown = newSpeed <= 30 && playerState.health > 0 && !playerState.isBeingAttacked;

      updatePlayerState(
        playerId,
        {
          speed: newSpeed,
          last_answer_time: new Date().toISOString(),
        },
        {
          speed: newSpeed,
          countdown: shouldStartCountdown && !playerState.countdown ? zombieAttackCountdown : playerState.countdown,
        }
      );
    },
    [playerStates, updatePlayerState, zombieAttackCountdown, t]
  );

  // ✅ Throttled handlers
  const throttledHandleCorrectAnswer = useMemo(
    () => throttle(handleCorrectAnswer, 100, { leading: true, trailing: true }),
    [handleCorrectAnswer]
  );

  const throttledHandleWrongAnswer = useMemo(
    () => throttle(handleWrongAnswer, 100, { leading: true, trailing: true }),
    [handleWrongAnswer]
  );

  // Manage player status — dengan early return
  const managePlayerStatus = useCallback(() => {
    if (!gameRoom) return;

    // ✅ Early return: tidak ada pemain aktif
    const hasActivePlayers = players.some((p) => {
      const state = playerStates[p.id];
      const isCompleted = completedPlayers.some((cp) => cp.id === p.id);
      return p.is_alive && state?.health > 0 && !isCompleted;
    });

    if (!hasActivePlayers) {
      if (players.length > 0) {
        supabase.from("game_rooms").update({ current_phase: "completed" }).eq("id", gameRoom.id);
        router.push(`/game/${roomCode}/resultshost`);
      }
      return;
    }

    // ✅ Early return: tidak ada countdown atau attack
    const hasCountdown = Object.values(playerStates).some(
      (state) => state.countdown !== undefined && state.countdown > 0
    );

    if (!hasCountdown && !zombieState.isAttacking) {
      return;
    }

    setPlayerStates((prev) => {
      const updatedStates = { ...prev };
      const newAttackQueue: string[] = [];
      let activePlayers = 0;
      let eligiblePlayer: string | null = null;

      Object.entries(updatedStates).forEach(([playerId, state]) => {
        const player = players.find((p) => p.id === playerId);
        const isCompleted = completedPlayers.some((cp) => cp.id === playerId);
        if (isCompleted || !player || state.health <= 0 || !player.is_alive) {
          updatedStates[playerId] = { ...state, countdown: undefined };
          return;
        }

        activePlayers++;
        if (state.speed <= 30 && !state.isBeingAttacked) {
          eligiblePlayer = playerId;
          if (!newAttackQueue.includes(playerId)) {
            newAttackQueue.push(playerId);
          }
        }
      });

      if (activePlayers === 0 && players.length > 0) {
        supabase.from("game_rooms").update({ current_phase: "completed" }).eq("id", gameRoom.id);
        router.push(`/game/${roomCode}/resultshost`);
        return updatedStates;
      }

      Object.entries(updatedStates).forEach(async ([playerId, state]) => {
        const player = players.find((p) => p.id === playerId);
        const isCompleted = completedPlayers.some((cp) => cp.id === playerId);
        if (!player || state.health <= 0 || !player.is_alive || isCompleted) {
          updatedStates[playerId] = { ...state, countdown: undefined };
          return;
        }

        const healthState = playerHealthStates[playerId];
        if (healthState) {
          const timeSinceLastAnswer = (Date.now() - new Date(healthState.last_answer_time).getTime()) / 1000;
          if (timeSinceLastAnswer >= zombieAttackCountdown + 5 && state.speed > 20) {
            const newSpeed = Math.max(20, state.speed - 10);
            await updatePlayerState(
              playerId,
              {
                speed: newSpeed,
                last_answer_time: new Date().toISOString(),
              },
              { speed: newSpeed }
            );
          }
        }

        if (state.speed <= 30 && !state.isBeingAttacked && state.health > 0) {
          if (state.countdown === undefined) {
            updatedStates[playerId] = { ...state, countdown: zombieAttackCountdown };
          } else if (state.countdown > 0) {
            const newCountdown = state.countdown - 1;
            updatedStates[playerId] = { ...state, countdown: newCountdown };
            if (newCountdown <= 0) {
              if (!zombieState.isAttacking || activePlayers === 1) {
                await updatePlayerState(
                  playerId,
                  {
                    health: state.health - 1,
                    is_being_attacked: true,
                  },
                  { countdown: undefined }
                );
                handleZombieAttack(playerId, state.health - 1, state.speed);
              } else {
                updatedStates[playerId] = { ...state, countdown: state.countdown };
              }
            }
          } else {
            updatedStates[playerId] = { ...state, countdown: undefined };
          }
        } else {
          updatedStates[playerId] = { ...state, countdown: undefined };
        }
      });

      setAttackQueue(
        newAttackQueue.filter((id) => {
          const state = updatedStates[id];
          const player = players.find((p) => p.id === id);
          const isCompleted = completedPlayers.some((cp) => cp.id === id);
          return state && state.speed <= 30 && state.health > 0 && player?.is_alive && !state.isBeingAttacked && !isCompleted;
        })
      );

      if (activePlayers === 1 && !zombieState.isAttacking && eligiblePlayer) {
        const state = updatedStates[eligiblePlayer];
        if (state && state.countdown !== undefined && state.countdown <= 0) {
          updatePlayerState(
            eligiblePlayer,
            {
              health: state.health - 1,
              is_being_attacked: true,
            },
            { countdown: undefined }
          );
          handleZombieAttack(eligiblePlayer, state.health - 1, state.speed);
        }
      }

      return updatedStates;
    });
  }, [gameRoom, playerStates, playerHealthStates, zombieState, handleZombieAttack, updatePlayerState, players, completedPlayers, router, roomCode, zombieAttackCountdown, t]);

  // Fetch game data
  const fetchGameData = useCallback(async () => {
    if (!roomCode) {
      console.error(t("log.invalidRoomCode"));
      setLoadingError(t("error.invalidRoomCode"));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("*, chaser_type, difficulty_level")
        .eq("room_code", roomCode.toUpperCase())
        .single();

      if (roomError || !room) {
        throw new Error(t("error.roomNotFound"));
      }

      setGameRoom(room);
      setChaserType(room.chaser_type || "zombie");

      if (room.current_phase === "completed") {
        setIsLoading(false);
        router.push(`/game/${roomCode}/resultshost`);
        return;
      }

      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true });

      if (playersError) throw new Error(t("error.fetchPlayers"));
      setPlayers(playersData || []);

      const { data: healthData, error: healthError } = await supabase
        .from("player_health_states")
        .select("*")
        .eq("room_id", room.id);

      if (healthError) throw new Error(t("error.fetchHealth"));
      initializePlayerStates(playersData || [], healthData || []);

      const { data: completionData, error: completionError } = await supabase
        .from("game_completions")
        .select("*, players(nickname, character_type)")
        .eq("room_id", room.id)
        .eq("completion_type", "completed");

      if (completionError) throw new Error(t("error.fetchCompletions"));
      const completed = completionData?.map((completion: any) => completion.players) || [];
      setCompletedPlayers(completed);
      if (completed.length > 0) {
        setShowCompletionPopup(true);
      }

      if (playersData && completionData && playersData.length === completionData.length) {
        await supabase.from("game_rooms").update({ current_phase: "completed" }).eq("id", room.id);
        setIsLoading(false);
        router.push(`/game/${roomCode}/resultshost`);
        return;
      }
    } catch (error) {
      console.error(t("log.fetchGameDataError", { error }));
      setLoadingError(t("error.loadGame"));
      setPlayers([]);
      setPlayerStates({});
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, initializePlayerStates, router, t]);

  // Sync completed players
  const syncCompletedPlayers = useCallback(async () => {
    if (!gameRoom) return;
    try {
      const { data, error } = await supabase
        .from("game_completions")
        .select("*, players(nickname, character_type)")
        .eq("room_id", gameRoom.id)
        .eq("completion_type", "completed");
      if (error) return;

      const completed = data?.map((completion: any) => completion.players) || [];
      setCompletedPlayers((prev) => {
        const newCompleted = completed.filter(
          (player: Player) => !prev.some((p) => p.id === player.id)
        );
        return [...prev, ...newCompleted];
      });
    } catch (error) {
      console.error(t("log.syncCompletedPlayersError", { error }));
    }
  }, [gameRoom, t]);

  useEffect(() => {
    syncCompletedPlayers();
    const interval = setInterval(syncCompletedPlayers, 5000);
    return () => clearInterval(interval);
  }, [syncCompletedPlayers]);

  // Supabase real-time subscriptions
  useEffect(() => {
    if (!gameRoom) return;

    const roomChannel = supabase.channel(`room-${gameRoom.id}`);
    const healthChannel = supabase.channel(`health-${gameRoom.id}`);
    const answerChannel = supabase.channel(`answers-${gameRoom.id}`);
    const completionChannel = supabase.channel(`completions-${gameRoom.id}`);
    const playerChannel = supabase.channel(`players-${gameRoom.id}`);

    roomChannel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${gameRoom.id}` },
        (payload) => {
          const newRoom = payload.new as GameRoom;
          setGameRoom(newRoom);
          setChaserType(newRoom.chaser_type || "zombie");
          if (newRoom.current_phase === "completed") {
            setIsLoading(false);
            router.push(`/game/${roomCode}/resultshost`);
          }
        }
      )
      .subscribe();

    healthChannel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "player_health_states", filter: `room_id=eq.${gameRoom.id}` },
        (payload) => {
          const healthState = payload.new as PlayerHealthState;
          setPlayerHealthStates((prev) => ({
            ...prev,
            [healthState.player_id]: healthState,
          }));
          setPlayerStates((prev) => {
            const current = prev[healthState.player_id] || {};
            return {
              ...prev,
              [healthState.player_id]: {
                ...current,
                health: healthState.health,
                speed: healthState.speed,
                isBeingAttacked: healthState.is_being_attacked,
                lastAttackTime: new Date(healthState.last_attack_time).getTime(),
                countdown:
                  healthState.speed <= 30 && !healthState.is_being_attacked && healthState.health > 0
                    ? zombieAttackCountdown
                    : undefined,
              },
            };
          });
        }
      )
      .subscribe();

    answerChannel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "player_answers", filter: `room_id=eq.${gameRoom.id}` },
        (payload) => {
          const answer = payload.new as any;
          if (answer.is_correct) {
            throttledHandleCorrectAnswer(answer.player_id);
          } else {
            throttledHandleWrongAnswer(answer.player_id);
          }
        }
      )
      .subscribe();

    completionChannel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_completions", filter: `room_id=eq.${gameRoom.id}` },
        async (payload) => {
          const completion = payload.new as GameCompletion;
          if (completion.completion_type === "completed") {
            const player = players.find((p) => p.id === completion.player_id);
            if (player) {
              setCompletedPlayers((prev) => {
                if (!prev.some((p) => p.id === player.id)) {
                  return [...prev, player];
                }
                return prev;
              });
              setShowCompletionPopup(true);
            }
          }
          const { data, error } = await supabase.from("game_completions").select("*").eq("room_id", gameRoom.id);
          if (!error && data.length === players.length) {
            await supabase.from("game_rooms").update({ current_phase: "completed" }).eq("id", gameRoom.id);
            setIsLoading(false);
            router.push(`/game/${roomCode}/resultshost`);
          }
        }
      )
      .subscribe();

    playerChannel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players", filter: `room_id=eq.${gameRoom.id}` },
        (payload) => {
          const updatedPlayer = payload.new as Player;
          setPlayers((prev) => prev.map((p) => (p.id === updatedPlayer.id ? { ...p, ...updatedPlayer } : p)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(healthChannel);
      supabase.removeChannel(answerChannel);
      supabase.removeChannel(completionChannel);
      supabase.removeChannel(playerChannel);
    };
  }, [gameRoom?.id, throttledHandleCorrectAnswer, throttledHandleWrongAnswer, players, router, roomCode, zombieAttackCountdown, t]); // ✅ Gunakan gameRoom.id

  // Initialize game data
  useEffect(() => {
    fetchGameData();
  }, [roomCode, fetchGameData, t]);

  // Interval for player status
  useEffect(() => {
    if (!gameRoom) return;
    const interval = setInterval(managePlayerStatus, 1500);
    return () => clearInterval(interval);
  }, [managePlayerStatus, gameRoom]);

  // Check image loading
  useEffect(() => {
    const testAllImages = async () => {
      const status: { [key: string]: boolean } = {};
      const characterFiles = [
        "/character/player/character.webp",
        "/character/player/character1-crop.webp",
        "/character/player/character2-crop.webp",
        "/character/player/character3-crop.webp",
        "/character/player/character4-crop.webp",
        "/character/player/character5.webp",
        "/character/player/character6.webp",
        "/character/player/character7-crop.webp",
        "/character/player/character8-crop.webp",
        "/character/player/character9-crop.webp",
      ];
      for (const file of characterFiles) {
        const works = await testImageLoad(file);
        status[file] = works;
      }
      const chaserFiles = [
        "/character/chaser/zombie.webp",
        "/character/chaser/monster1.webp",
        "/character/chaser/monster2.webp",
        "/character/chaser/monster3.webp",
        "/character/chaser/darknight.webp",
      ];
      for (const file of chaserFiles) {
        const works = await testImageLoad(file);
        status[file] = works;
      }
      setImageLoadStatus(status);
    };
    testAllImages();
  }, [t]);

  const testImageLoad = (src: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
      setTimeout(() => resolve(false), 5000);
    });
  };

  // Set client and screen size
  useEffect(() => {
    setIsClient(true);
    setScreenWidth(window.innerWidth);
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [t]);

  // Animation time — hanya tergantung gameMode
  useEffect(() => {
    const interval = setInterval(() => setAnimationTime((prev) => prev + 1), gameMode === "panic" ? 30 : 100);
    return () => clearInterval(interval);
  }, [gameMode]); // ❗ Hanya gameMode

  // Check Supabase connection
  useEffect(() => {
    const checkConnection = () => {
      const state = supabase.getChannels()[0]?.state || "closed";
      setIsConnected(state === "joined");
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [t]);

  // ✅ Memoisasi activePlayers dan centerX
  const activePlayers = useMemo(() => {
    return players.filter((p) => !completedPlayers.some((c) => c.id === p.id));
  }, [players, completedPlayers]);

  const centerX = useMemo(() => screenWidth / 2, [screenWidth]);

  // ✅ Audio effect — hanya sekali
  useEffect(() => {
    const zombiesAudio = new Audio('/musics/zombies.mp3');
    const bgAudio = new Audio('/musics/background-music.mp3');

    zombiesAudio.play().catch(console.warn);
    bgAudio.loop = true;
    bgAudio.play().catch(console.warn);

    return () => {
      zombiesAudio.pause();
      bgAudio.pause();
      zombiesAudio.src = '';
      bgAudio.src = '';
    };
  }, []);

  // Loading & completed state
  if (!isClient || isLoading) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">{loadingError ? loadingError : t("loadingChase")}</div>
      </div>
    );
  }

  if (gameRoom?.current_phase === "completed") {
    return null;
  }

  // ✅ Render akhir
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <MemoizedBackground3 isFlashing={backgroundFlash} />

      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, type: "spring", stiffness: 120 }}
        className="flex flex-col gap-3 mb-10 px-4"
      >
        <div className="flex justify-between items-center">
          <h1
            className="text-5xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
            style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
          >
            {t("title")}
          </h1>

          <div className="flex w-fit gap-2 items-center">
            <Image src={`/logo/Gemini_Generated_Image_90360u90360u9036-removebg-preview.png`} alt="" width={254} height={0} className="z-20" />
          </div>
        </div>
      </motion.header>

      <RunningCharacters
        players={activePlayers}
        playerStates={playerStates}
        zombieState={zombieState}
        animationTime={animationTime}
        gameMode={gameMode}
        centerX={centerX}
        completedPlayers={completedPlayers}
      />
      <ZombieCharacter
        zombieState={zombieState}
        animationTime={animationTime}
        gameMode={gameMode}
        centerX={centerX}
        chaserType={chaserType}
        players={activePlayers}
      />

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <MemoizedGameUI roomCode={roomCode} />
      </div>

      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #ff0000 rgba(26, 0, 0, 0.8);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(26, 0, 0, 0.8);
          border-left: 2px solid rgba(255, 0, 0, 0.3);
          box-shadow: inset 0 0 6px rgba(255, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b0000, #ff0000);
          border-radius: 6px;
          border: 2px solid rgba(255, 0, 0, 0.5);
          box-shadow: 0 0 8px rgba(255, 0, 0, 0.7);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #ff0000, #8b0000);
          box-shadow: 0 0 12px rgba(255, 0, 0, 0.9);
        }
      `}</style>
    </div>
  );
}