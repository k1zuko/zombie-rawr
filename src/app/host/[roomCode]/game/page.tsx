"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Background3 from "@/components/game/host/Background3";
import GameUI from "@/components/game/host/GameUI";
import { motion } from "framer-motion";
import ZombieCharacter from "@/components/game/host/ZombieCharacter";
import RunningCharacters from "@/components/game/host/RunningCharacters";
import { useHostGuard } from "@/lib/host-guard";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import { throttle } from "lodash";
import React from "react";
import type { GameRoom, EmbeddedPlayer as Player } from "@/lib/supabase";

// User-configurable Zombie Position for Mobile Landscape
const ZOMBIE_MOBILE_VERTICAL_OFFSET = 11; // Percentage from the top (e.g., 85 means 85% down)
const ZOMBIE_MOBILE_HORIZONTAL_OFFSET = 50; // Pixels from the center, positive to move right

// Custom hook to get the previous value of a prop or state
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const MemoizedBackground3 = React.memo(Background3);
const MemoizedGameUI = React.memo(GameUI);

const MemoizedRunningCharacters = React.memo(
  RunningCharacters,
  (prevProps, nextProps) => {
    return (
      prevProps.players === nextProps.players &&
      prevProps.playerStates === nextProps.playerStates &&
      prevProps.zombieState.targetPlayerId === nextProps.zombieState.targetPlayerId &&
      prevProps.gameMode === nextProps.gameMode &&
      prevProps.centerX === nextProps.centerX &&
      prevProps.completedPlayers === nextProps.completedPlayers
    );
  }
);

const MemoizedZombieCharacter = React.memo(
  ZombieCharacter,
  (prevProps, nextProps) => {
    const prevZ = prevProps.zombieState;
    const nextZ = nextProps.zombieState;
    return (
      prevZ.isAttacking === nextZ.isAttacking &&
      prevZ.targetPlayerId === nextZ.targetPlayerId &&
      prevZ.attackProgress === nextZ.attackProgress &&
      prevProps.gameMode === nextProps.gameMode &&
      prevProps.centerX === nextProps.centerX &&
      prevProps.chaserType === nextProps.chaserType &&
      prevProps.players === nextProps.players
    );
  }
);

interface PlayerState {
  id: string;
  health: number;
  maxHealth: number;
  speed: number;
  position: number;
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

export default function HostGamePage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [animationTime, setAnimationTime] = useState(0);
  const [gameMode, setGameMode] = useState<"normal" | "panic">("normal");
  const [isClient, setIsClient] = useState(false);
  const [screenWidth, setScreenWidth] = useState(1200);
  const [screenHeight, setScreenHeight] = useState(800);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const prevGameRoom = usePrevious(gameRoom); // <-- Track previous gameRoom state
  const [chaserType, setChaserType] = useState<"zombie" | "monster1" | "monster2" | "monster3" | "darknight">("zombie");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [completedPlayers, setCompletedPlayers] = useState<Player[]>([]);
  const [playerStates, setPlayerStates] = useState<{ [playerId: string]: PlayerState }>({});
  const [zombieState, setZombieState] = useState<ZombieState>({
    isAttacking: false,
    targetPlayerId: null,
    attackProgress: 0,
    basePosition: 500,
    currentPosition: 500,
  });
  const [attackQueue, setAttackQueue] = useState<string[]>([]);
  const [backgroundFlash, setBackgroundFlash] = useState<boolean>(false);
  const attackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useHostGuard(roomCode);

  const memoizedZombieState = useMemo(() => ({
    isAttacking: zombieState.isAttacking,
    targetPlayerId: zombieState.targetPlayerId,
    attackProgress: zombieState.attackProgress,
    basePosition: zombieState.basePosition,
    currentPosition: zombieState.currentPosition,
  }), [zombieState.isAttacking, zombieState.targetPlayerId, zombieState.attackProgress]);

  const initializePlayerStates = useCallback((playersData: Player[]) => {
    const newStates: { [playerId: string]: PlayerState } = {};
    playersData.forEach((player, index) => {
      newStates[player.player_id] = {
        id: player.player_id,
        health: player.health.current,
        maxHealth: player.health.max,
        speed: player.health.speed,
        position: index,
        attackIntensity: 0,
      };
    });
    setPlayerStates(newStates);
  }, []);

  const updatePlayerState = useCallback(async (playerId: string, updates: Partial<Player>) => {
    if (!gameRoom) return;
    const currentPlayers = gameRoom.players || [];
    const playerIndex = currentPlayers.findIndex((p: Player) => p.player_id === playerId);
    if (playerIndex === -1) return;

    const originalPlayer = currentPlayers[playerIndex];
    const updatedPlayer = {
      ...originalPlayer,
      ...updates,
      health: { ...originalPlayer.health, ...(updates.health || {}) },
    };
    
    const updatedPlayers = [...currentPlayers];
    updatedPlayers[playerIndex] = updatedPlayer;

    await supabase.from("game_rooms").update({ players: updatedPlayers }).eq("id", gameRoom.id);
  }, [gameRoom]);

  const handleZombieAttack = useCallback((playerId: string) => {
    const player = gameRoom?.players.find((p) => p.player_id === playerId);
    if (!player || !player.is_alive || zombieState.isAttacking) return;

    if (attackIntervalRef.current) clearInterval(attackIntervalRef.current);

    setZombieState({ isAttacking: true, targetPlayerId: playerId, attackProgress: 0, basePosition: 500, currentPosition: 500 });
    setGameMode("panic");

    let progress = 0;
    attackIntervalRef.current = setInterval(() => {
      progress += 0.0333;
      setZombieState((prev) => ({ ...prev, attackProgress: progress, currentPosition: prev.basePosition * (1 - progress * 0.8) }));

      if (progress >= 1) {
        clearInterval(attackIntervalRef.current!);
        attackIntervalRef.current = null;
        setZombieState({ isAttacking: false, targetPlayerId: null, attackProgress: 0, basePosition: 500, currentPosition: 500 });
        setGameMode("normal");
      }
    }, 30);
  }, [gameRoom, zombieState.isAttacking]);

  const fetchGameData = useCallback(async () => {
    if (!roomCode) {
      setLoadingError(t("error.invalidRoomCode"));
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data: room, error: roomError } = await supabase.from("game_rooms").select("*").eq("room_code", roomCode.toUpperCase()).single();
      if (roomError || !room) throw new Error(t("error.roomNotFound"));
      setGameRoom(room as GameRoom);
    } catch (error) {
      console.error(t("log.fetchGameDataError", { error }));
      setLoadingError(t("error.loadGame"));
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, t]);

  // Initial fetch
  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  // Supabase Realtime Subscription (simplified)
  useEffect(() => {
    if (!gameRoom?.id) return;
    const roomChannel = supabase.channel(`room-${gameRoom.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${gameRoom.id}` },
        (payload) => {
          setGameRoom(payload.new as GameRoom);
        }
      ).subscribe();
    return () => { supabase.removeChannel(roomChannel); };
  }, [gameRoom?.id]);

  // Effect to react to gameRoom changes from Realtime
  useEffect(() => {
    if (prevGameRoom && gameRoom) {
      // 1. Update players and states
      const playersData = (gameRoom.players as Player[] || []).sort((a: Player, b: Player) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
      setPlayers(playersData);
      initializePlayerStates(playersData);
      setChaserType(gameRoom.chaser_type || "zombie");

      // 2. Check for health decrease to trigger attack
      gameRoom.players.forEach(newPlayer => {
        const oldPlayer = prevGameRoom.players.find(p => p.player_id === newPlayer.player_id);
        if (oldPlayer && newPlayer.health.current < oldPlayer.health.current && newPlayer.is_alive) {
          if (!zombieState.isAttacking) {
            handleZombieAttack(newPlayer.player_id);
          } else {
            setAttackQueue(prev => prev.includes(newPlayer.player_id) ? prev : [...prev, newPlayer.player_id]);
          }
        }
      });

      // 3. Check for game end
      if (gameRoom.status === "finished") {
        router.push(`/host/${roomCode}/result`);
      }
    }
  }, [gameRoom, prevGameRoom, initializePlayerStates, router, roomCode, handleZombieAttack, zombieState.isAttacking]);

  // Effect for handling screen size and orientation
  useEffect(() => {
    setIsClient(true);
    
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
      setScreenHeight(window.innerHeight);
      const isMobile = window.innerWidth <= 768;
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      setIsPortraitMobile(isMobile && isPortrait);
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // New useEffect to handle game end when no players are active
  useEffect(() => {
    if (gameRoom && gameRoom.status !== 'finished' && players.length > 0) {
      const activePlayers = players.filter(p => p.is_alive && p.health.current > 0 && !completedPlayers.some(cp => cp.player_id === p.player_id));
      if (activePlayers.length === 0) {
        const finishGame = async () => {
          await supabase
            .from("game_rooms")
            .update({ status: "finished" })
            .eq("id", gameRoom.id);
        };
        // Add a small delay to allow final animations to complete
        const timer = setTimeout(finishGame, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [players, completedPlayers, gameRoom, supabase]);

  useEffect(() => {
    const interval = setInterval(() => setAnimationTime(prev => prev + 1), gameMode === "panic" ? 30 : 100);
    return () => clearInterval(interval);
  }, [gameMode]);

  const activePlayers = useMemo(() => {
    return players.filter((p) => !completedPlayers.some((c) => c.player_id === p.player_id));
  }, [players, completedPlayers]);

  const centerX = useMemo(() => screenWidth / 2, [screenWidth]);

  useEffect(() => {
    const zombiesAudio = new Audio('/musics/zombies.mp3');
    const bgAudio = new Audio('/musics/background-music.mp3');
    zombiesAudio.play().catch(console.warn);
    bgAudio.loop = true;
    bgAudio.play().catch(console.warn);
    return () => {
      zombiesAudio.pause();
      bgAudio.pause();
    };
  }, []);

  if (!isClient || isLoading) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">{loadingError ? loadingError : t("loading")}</div>
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
          <h1
            className="text-5xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
            style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
          >
            {t("title")}
          </h1>
          <div className="flex w-fit gap-2 items-center">
            <Image src={`/logo/gameforsmartlogo-horror.png`} alt="" width={254} height={0} className="z-20" />
          </div>
        </div>
      </motion.header>
      <MemoizedRunningCharacters
        players={activePlayers}
        playerStates={playerStates}
        zombieState={zombieState}
        animationTime={animationTime}
        gameMode={gameMode}
        centerX={centerX}
        completedPlayers={completedPlayers}
      />
      <MemoizedZombieCharacter
        zombieState={memoizedZombieState}
        gameMode={gameMode}
        centerX={centerX}
        chaserType={chaserType}
        players={activePlayers}
        animationTime={animationTime}
        screenHeight={screenHeight} // Add screenHeight prop
        isPortraitMobile={isPortraitMobile} // Add isPortraitMobile prop
        mobileHorizontalShift={ZOMBIE_MOBILE_HORIZONTAL_OFFSET} // Pass the horizontal offset
      />
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <MemoizedGameUI roomCode={roomCode} />
      </div>
    </div>
  );
}