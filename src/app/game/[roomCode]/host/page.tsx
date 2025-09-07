"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Background3 from "@/components/game/host/Background3"; // Gunakan Background3, hapus duplikasi
import GameUI from "@/components/game/host/GameUI";
import { motion, AnimatePresence } from "framer-motion";
import ZombieCharacter from "@/components/game/host/ZombieCharacter";
import RunningCharacters from "@/components/game/host/RunningCharacters";
import { useHostGuard } from "@/lib/host-guard";
import { useTranslation } from "react-i18next";
import Image from "next/image";

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
  difficulty_level: string; // Tambahkan difficulty_level
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
    easy: { zombieAttackCountdown: 25 },
    medium: { zombieAttackCountdown: 10 },
    hard: { zombieAttackCountdown: 5 },
  };
  const zombieAttackCountdown = gameRoom && ["easy", "medium", "hard"].includes(gameRoom.difficulty_level)
    ? difficultySettings[gameRoom.difficulty_level as keyof typeof  difficultySettings].zombieAttackCountdown
    : difficultySettings.medium.zombieAttackCountdown; // Default ke medium

  // Initialize player states
  const initializePlayerStates = useCallback(
    (playersData: Player[], healthData: PlayerHealthState[]) => {
      console.log(t("log.initializePlayerStates", { count: playersData.length }));
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
              ? zombieAttackCountdown // Gunakan zombieAttackCountdown
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
      if (!gameRoom) {
        console.log(t("log.noGameRoom"));
        return;
      }

      try {
        console.log(t("log.updatePlayerState", { playerId, updates }));
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
        console.log(t("log.updatePlayerStateSuccess", { playerId }));
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
        console.log(t("log.invalidPlayerForAttack", { playerId, health: newHealth, is_alive: player?.is_alive }));
        setAttackQueue((prev) => prev.filter((id) => id !== playerId));
        return;
      }

      if (zombieState.isAttacking && zombieState.targetPlayerId !== playerId) {
        console.log(t("log.chaserBusy", { targetPlayerId: zombieState.targetPlayerId, playerId }));
        setAttackQueue((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
        return;
      }

      if (attackIntervalRef.current) {
        clearInterval(attackIntervalRef.current);
        attackIntervalRef.current = null;
      }

      console.log(t("log.startAttack", { playerId, health: newHealth, speed: newSpeed }));
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

          console.log(t("log.attackFinished", { playerId, health: newHealth, speed: finalSpeed }));
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

          // Process next attack in queue
          setAttackQueue((prev) => {
            const nextQueue = prev.filter((id) => id !== playerId);
            if (nextQueue.length > 0) {
              const nextPlayerId = nextQueue[0];
              const nextState = playerStates[nextPlayerId];
              const nextPlayer = players.find((p) => p.id === nextPlayerId);
              if (nextState && nextState.speed <= 30 && nextState.health > 0 && nextPlayer?.is_alive) {
                console.log(t("log.processNextQueue", { nextPlayerId }));
                setTimeout(() => {
                  handleZombieAttack(nextPlayerId, nextState.health - 1, nextState.speed);
                }, 500);
              } else {
                console.log(t("log.nextPlayerInvalid", { nextPlayerId }));
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

      console.log(t("log.countdownSync", { elapsed, remaining }));
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

  // Handle correct answer
  const handleCorrectAnswer = useCallback(
    (playerId: string) => {
      const playerState = playerStates[playerId];
      if (!playerState) {
        console.log(t("log.playerNotFoundCorrect", { playerId }));
        return;
      }

      const newSpeed = Math.min(playerState.speed + 5, 100);
      const shouldResetCountdown = newSpeed <= 30;

      console.log(t("log.correctAnswer", { playerId, newSpeed }));
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
        console.log(t("log.stopAttackCorrect", { playerId }));
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

  // Handle wrong answer
  const handleWrongAnswer = useCallback(
    (playerId: string) => {
      const playerState = playerStates[playerId];
      if (!playerState) {
        console.log(t("log.playerNotFoundWrong", { playerId }));
        return;
      }

      const newSpeed = Math.max(20, playerState.speed - 5);
      const shouldStartCountdown = newSpeed <= 30 && playerState.health > 0 && !playerState.isBeingAttacked;

      console.log(t("log.wrongAnswer", { playerId, newSpeed }));
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

  // Manage player status and inactivity penalties
  const managePlayerStatus = useCallback(() => {
    if (!gameRoom) {
      console.log(t("log.noGameRoom"));
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

        console.log(t("log.playerStatus", {
          nickname: player?.nickname || playerId,
          health: state.health,
          is_alive: player?.is_alive,
          isCompleted
        }));
        activePlayers++;
        if (state.speed <= 30 && !state.isBeingAttacked) {
          eligiblePlayer = playerId;
          if (!newAttackQueue.includes(playerId)) {
            newAttackQueue.push(playerId);
          }
        }
      });

      console.log(t("log.activePlayers", { count: activePlayers, queue: newAttackQueue }));

      if (activePlayers === 0 && players.length > 0) {
        console.log(t("log.allPlayersCompleted"));
        supabase
          .from("game_rooms")
          .update({ current_phase: "completed" })
          .eq("id", gameRoom.id)
          .then(() => {
            router.push(`/game/${roomCode}/resultshost`);
          });
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
            console.log(t("log.playerInactive", { playerId, newSpeed }));
            await updatePlayerState(
              playerId,
              {
                speed: newSpeed,
                last_answer_time: new Date().toISOString(),
              },
              { speed: newSpeed },
            );
          }
        }

        if (state.speed <= 30 && !state.isBeingAttacked && state.health > 0) {
          if (state.countdown === undefined) {
            console.log(t("log.addCountdown", { playerId }));
            updatedStates[playerId] = { ...state, countdown: zombieAttackCountdown };
          } else if (state.countdown > 0) {
            const newCountdown = state.countdown - 1;
            console.log(t("log.countdown", { playerId, countdown: newCountdown }));
            updatedStates[playerId] = { ...state, countdown: newCountdown };
            if (newCountdown <= 0) {
              if (!zombieState.isAttacking || activePlayers === 1) {
                console.log(t("log.startAttack", { playerId, health: state.health }));
                await updatePlayerState(
                  playerId,
                  {
                    health: state.health - 1,
                    is_being_attacked: true,
                  },
                  { countdown: undefined },
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
        console.log(t("log.singlePlayerAttack", { playerId: eligiblePlayer }));
        const state = updatedStates[eligiblePlayer];
        if (state && state.countdown !== undefined && state.countdown <= 0) {
          updatePlayerState(
            eligiblePlayer,
            {
              health: state.health - 1,
              is_being_attacked: true,
            },
            { countdown: undefined },
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
      console.time("fetchGameData");

      console.time("fetchRoom");
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("*, chaser_type, difficulty_level")
        .eq("room_code", roomCode.toUpperCase())
        .single();
      console.timeEnd("fetchRoom");

      if (roomError || !room) {
        console.error(t("log.fetchRoomError", { error: roomError?.message }));
        throw new Error(t("error.roomNotFound"));
      }
      console.log(t("log.fetchRoomSuccess", { room }));
      setGameRoom(room);
      setChaserType(room.chaser_type || "zombie");

      if (room.current_phase === "completed") {
        console.log(t("log.phaseCompleted"));
        setIsLoading(false);
        router.push(`/game/${roomCode}/resultshost`);
        return;
      }

      console.time("fetchPlayers");
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true });
      console.timeEnd("fetchPlayers");

      if (playersError) {
        console.error(t("log.fetchPlayersError", { error: playersError.message }));
        throw new Error(t("error.fetchPlayers"));
      }
      console.log(t("log.fetchPlayersSuccess", { count: playersData?.length }));
      setPlayers(playersData || []);

      console.time("fetchHealth");
      const { data: healthData, error: healthError } = await supabase
        .from("player_health_states")
        .select("*")
        .eq("room_id", room.id);
      console.timeEnd("fetchHealth");

      if (healthError) {
        console.error(t("log.fetchHealthError", { error: healthError.message }));
        throw new Error(t("error.fetchHealth"));
      }
      initializePlayerStates(playersData || [], healthData || []);

      console.time("fetchCompletions");
      const { data: completionData, error: completionError } = await supabase
        .from("game_completions")
        .select("*, players(nickname, character_type)")
        .eq("room_id", room.id)
        .eq("completion_type", "completed");
      console.timeEnd("fetchCompletions");

      if (completionError) {
        console.error(t("log.fetchCompletionsError", { error: completionError.message }));
        throw new Error(t("error.fetchCompletions"));
      }
      const completed = completionData?.map((completion: any) => completion.players) || [];
      setCompletedPlayers(completed);
      if (completed.length > 0) {
        setShowCompletionPopup(true);
      }

      if (playersData && completionData && playersData.length === completionData.length) {
        console.log(t("log.allPlayersCompletedFetch"));
        await supabase.from("game_rooms").update({ current_phase: "completed" }).eq("id", room.id);
        setIsLoading(false);
        router.push(`/game/${roomCode}/resultshost`);
        return;
      }

      console.timeEnd("fetchGameData");
    } catch (error) {
      console.error(t("log.fetchGameDataError", { error }));
      setLoadingError(t("error.loadGame"));
      setPlayers([]);
      setPlayerStates({});
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, initializePlayerStates, router, t]);

  // Sync completed players periodically
  const syncCompletedPlayers = useCallback(async () => {
    if (!gameRoom) return;
    try {
      console.log(t("log.syncCompletedPlayers"));
      const { data, error } = await supabase
        .from("game_completions")
        .select("*, players(nickname, character_type)")
        .eq("room_id", gameRoom.id)
        .eq("completion_type", "completed");
      if (error) {
        console.error(t("log.syncCompletedPlayersError", { error: error.message }));
        return;
      }
      const completed = data?.map((completion: any) => completion.players) || [];
      setCompletedPlayers((prev) => {
        const newCompleted = completed.filter(
          (player: Player) => !prev.some((p) => p.id === player.id)
        );
        console.log(t("log.newCompletedPlayers", { nicknames: newCompleted.map((p: Player) => p.nickname).join(", ") }));
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

    console.log(t("log.setupRealtime", { roomId: gameRoom.id }));
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
          console.log(t("log.roomChangeDetected", { room: payload.new }));
          const newRoom = payload.new as GameRoom;
          setGameRoom(newRoom);
          setChaserType(newRoom.chaser_type || "zombie");
          if (newRoom.current_phase === "completed") {
            console.log(t("log.redirectToResultsHost"));
            setIsLoading(false);
            router.push(`/game/${roomCode}/resultshost`);
          }
        }
      )
      .subscribe((status) => {
        console.log(t("log.roomSubscriptionStatus", { status }));
      });

    healthChannel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "player_health_states", filter: `room_id=eq.${gameRoom.id}` },
        (payload) => {
          console.log(t("log.healthChangeDetected", { payload }));
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
      .subscribe((status) => {
        console.log(t("log.healthSubscriptionStatus", { status }));
      });

    answerChannel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "player_answers", filter: `room_id=eq.${gameRoom.id}` },
        (payload) => {
          console.log(t("log.newAnswerReceived", { payload }));
          const answer = payload.new as any;
          if (answer.is_correct) {
            handleCorrectAnswer(answer.player_id);
          } else {
            handleWrongAnswer(answer.player_id);
          }
        }
      )
      .subscribe((status) => {
        console.log(t("log.answerSubscriptionStatus", { status }));
      });

    completionChannel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_completions", filter: `room_id=eq.${gameRoom.id}` },
        async (payload) => {
          console.log(t("log.completionDetected", { payload }));
          const completion = payload.new as GameCompletion;
          console.log(t("log.playerCompletion", { playerId: completion.player_id, completion_type: completion.completion_type }));
          if (completion.completion_type === "completed") {
            const player = players.find((p) => p.id === completion.player_id);
            if (player) {
              console.log(t("log.addToCompletedPlayers", { nickname: player.nickname }));
              setCompletedPlayers((prev) => {
                if (!prev.some((p) => p.id === player.id)) {
                  return [...prev, player];
                }
                return prev;
              });
              setShowCompletionPopup(true);
            } else {
              console.warn(t("log.playerNotFound", { playerId: completion.player_id }));
            }
          }
          const { data, error } = await supabase.from("game_completions").select("*").eq("room_id", gameRoom.id);
          if (error) {
            console.error(t("log.checkCompletionsError", { error: error.message }));
          } else {
            console.log(t("log.totalCompletions", { count: data.length, totalPlayers: players.length }));
            if (data.length === players.length) {
              console.log(t("log.allPlayersCompletedRedirect"));
              await supabase.from("game_rooms").update({ current_phase: "completed" }).eq("id", gameRoom.id);
              setIsLoading(false);
              router.push(`/game/${roomCode}/resultshost`);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(t("log.completionSubscriptionStatus", { status }));
        if (status === "SUBSCRIBED") {
          console.log(t("log.completionSubscriptionSuccess"));
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          console.warn(t("log.completionSubscriptionError", { status }));
        }
      });

    playerChannel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players", filter: `room_id=eq.${gameRoom.id}` },
        (payload) => {
          console.log(t("log.playerChangeDetected", { payload }));
          const updatedPlayer = payload.new as Player;
          setPlayers((prev) => prev.map((p) => (p.id === updatedPlayer.id ? { ...p, ...updatedPlayer } : p)));
        }
      )
      .subscribe((status) => {
        console.log(t("log.playerSubscriptionStatus", { status }));
      });

    return () => {
      console.log(t("log.unsubscribeChannels"));
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(healthChannel);
      supabase.removeChannel(answerChannel);
      supabase.removeChannel(completionChannel);
      supabase.removeChannel(playerChannel);
    };
  }, [gameRoom, handleCorrectAnswer, handleWrongAnswer, players, router, roomCode, zombieAttackCountdown, t]);

  // Initialize game data
  useEffect(() => {
    console.log(t("log.initHostPage", { roomCode }));
    fetchGameData();
  }, [roomCode, fetchGameData, t]);

  // Interval for player status
  useEffect(() => {
    if (!gameRoom) return;
    const interval = setInterval(managePlayerStatus, 1000);
    return () => clearInterval(interval);
  }, [managePlayerStatus, gameRoom]);

  // Check image loading
  useEffect(() => {
    const testAllImages = async () => {
      console.log(t("log.checkImageLoading"));
      const status: { [key: string]: boolean } = {};
      const characterFiles = [
        "/character/player/character.gif",
        "/character/player/character1.gif",
        "/character/player/character2.gif",
        "/character/player/character3.gif",
        "/character/player/character4.gif",
        "/character/player/character5.gif",
        "/character/player/character6.gif",
        "/character/player/character7.gif",
        "/character/player/character8.gif",
        "/character/player/character9.gif",
      ];
      for (const file of characterFiles) {
        const works = await testImageLoad(file);
        status[file] = works;
      }
      const chaserFiles = [
        "/character/chaser/zombie.gif",
        "/character/chaser/monster1.gif",
        "/character/chaser/monster2.gif",
        "/character/chaser/monster3.gif",
        "/character/chaser/darknight.gif",
      ];
      for (const file of chaserFiles) {
        const works = await testImageLoad(file);
        status[file] = works;
      }
      setImageLoadStatus(status);
      console.log(t("log.imageLoadingComplete", { status }));
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
    console.log(t("log.setIsClient"));
    setIsClient(true);
    setScreenWidth(window.innerWidth);
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [t]);

  // Animation time
  useEffect(() => {
    const interval = setInterval(() => setAnimationTime((prev) => prev + 1), gameMode === "panic" ? 30 : 100);
    return () => clearInterval(interval);
  }, [gameMode]);

  // Check Supabase connection
  useEffect(() => {
    const checkConnection = () => {
      const state = supabase.getChannels()[0]?.state || "closed";
      console.log(t("log.supabaseConnectionStatus", { state }));
      setIsConnected(state === "joined");
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [t]);

  const getLoopPosition = (speed: number, spacing: number, offset = 0) => {
    const totalDistance = screenWidth + spacing;
    const position = (animationTime * speed + offset) % totalDistance;
    return position > 0 ? position - spacing : totalDistance + position - spacing;
  };

  const getWorkingImagePath = (character: { src: string }) => {
    return imageLoadStatus[character.src] ? character.src : "/character/player/character.gif";
  };

  const activePlayers = players.filter((p) => !completedPlayers.some((c) => c.id === p.id));

  if (!isClient || isLoading) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">{loadingError ? loadingError : t("loadingChase")}</div>
      </div>
    );
  }

  if (gameRoom?.current_phase === "completed") {
    return <p></p>;
  }

  const centerX = screenWidth / 2;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <Background3 isFlashing={backgroundFlash} />
      <audio src="/musics/zombies.mp3" autoPlay />
      <audio src="/musics/background-music.mp3" autoPlay loop />
      {/* <AnimatePresence>
        {Object.entries(playerStates)
          .filter(([_, state]) => state.countdown !== undefined && state.countdown > 0)
          .slice(0, 10)
          .map(([playerId, state]) => {
            const player = players.find((p) => p.id === playerId);
            if (!player) return null;
            return (
              <motion.div
                key={`countdown-${playerId}`}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex items-center bg-red-900/90 text-white font-mono text-sm px-3 py-2 rounded-lg shadow-lg border border-red-500/50 w-[240px] animate-pulse"
              >
                <span className="flex-1 truncate">{player.nickname}</span>
                <span className="ml-2 font-bold text-yellow-300">{state.countdown}s</span>
              </motion.div>
            );
          })}
      </AnimatePresence> */}

      {/* <h6
        className="text-2xl sm:text-2xl md:text-5xl font-bold font-mono tracking-wider text-red-600 drop-shadow-[0_0_10px_rgba(39,68,0)]"
        style={{ textShadow: "0 0 15px rgba(239, 68, 68, 0.9), 0 0 20px rgba(0, 0, 0, 0.5)" }}
      >
        {t("title")}
      </h6> */}
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
        playerHealthStates={playerHealthStates}
        zombieState={zombieState}
        animationTime={animationTime}
        gameMode={gameMode}
        centerX={centerX}
        getWorkingImagePath={getWorkingImagePath}
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
        <GameUI roomCode={roomCode} />
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