"use client";

import { Heart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";

interface Player {
  id: string;
  nickname: string;
  character_type: string;
  score: number;
  is_alive: boolean;
  joined_at: string;
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
}

interface PlayerState {
  id: string;
  health: number;
  speed: number;
  isBeingAttacked: boolean;
  position: number;
  lastAttackTime: number;
  attackIntensity: number;
}

interface ZombieState {
  isAttacking: boolean;
  targetPlayerId: string | null;
  attackProgress: number;
  basePosition: number;
  currentPosition: number;
}

interface RunningCharactersProps {
  players: Player[];
  playerStates: { [playerId: string]: PlayerState };
  playerHealthStates: { [playerId: string]: PlayerHealthState };
  zombieState: ZombieState;
  animationTime: number;
  gameMode: "normal" | "panic";
  centerX: number;
  getCharacterByType: (type: string) => any;
  getWorkingImagePath: (character: any) => string;
  completedPlayers: Player[];
}

export default function RunningCharacters({
  players,
  playerStates,
  playerHealthStates,
  zombieState,
  animationTime,
  gameMode,
  centerX,
  getCharacterByType,
  getWorkingImagePath,
  completedPlayers,
}: RunningCharactersProps) {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode as string;

  // Gunakan useMemo untuk menghitung pemain aktif dan menghindari perhitungan berulang
  const activePlayers = useMemo(() => {
    return players.filter((player) => {
      const playerState = playerStates[player.id];
      const healthState = playerHealthStates[player.id];
      const health = playerState?.health ?? healthState?.health ?? 3;
      const isCompleted = completedPlayers.some((cp) => cp.id === player.id);
      const isEliminated = !player.is_alive || health <= 0;
      return !isCompleted && !isEliminated;
    });
  }, [players, playerStates, playerHealthStates, completedPlayers]);

  useEffect(() => {
    // Log untuk debugging
    console.log("Active players:", activePlayers.map((p) => p.nickname));
    console.log("Completed players:", completedPlayers.map((p) => p.nickname));
    console.log("Total players:", players.length);

    // Redirect jika tidak ada pemain aktif dan ada pemain di room
    if (activePlayers.length === 0 && players.length > 0) {
      console.log("Tidak ada pemain aktif tersisa, redirect ke resultshost");
      const redirectTimeout = setTimeout(() => {
        router.push(`/game/${roomCode}/resultshost`);
      }, 1000);
      return () => clearTimeout(redirectTimeout);
    }
  }, [activePlayers, players, router, roomCode]);

  return (
    <div className="absolute bottom-20 z-30">
      {players.slice(0, 5).map((player, i) => {
        const character = getCharacterByType(player.character_type);
        const workingPath = getWorkingImagePath(character);
        const playerState = playerStates[player.id];
        const healthState = playerHealthStates[player.id];
        const isBeingAttacked = playerState?.isBeingAttacked || false;
        const health = playerState?.health ?? healthState?.health ?? 3;
        const speed = playerState?.speed ?? healthState?.speed ?? 20;
        const attackIntensity = playerState?.attackIntensity ?? 0;
        const isZombieTarget = zombieState.targetPlayerId === player.id;
        const isCompleted = completedPlayers.some((cp) => cp.id === player.id);
        const isEliminated = !player.is_alive || health <= 0;

        // Jangan render pemain yang sudah lolos atau tereliminasi
        if (isEliminated || isCompleted) {
          console.log(`Skipping render for ${player.nickname} - Eliminated: ${isEliminated}, Completed: ${isCompleted}`);
          return null;
        }

        const speedOffset = (speed - 20) * 10;
        const charX =
          centerX -
          130 +
          i * 120 +
          speedOffset +
          Math.sin(animationTime * (gameMode === "panic" ? 1.2 : 0.4) + i) *
            (gameMode === "panic" ? 60 : 15);
        const charY =
          -77 +
          Math.abs(Math.sin(animationTime * (gameMode === "panic" ? 2 : 0.6) + i * 0.5)) *
            (gameMode === "panic" ? 25 : 8);

        const attackShakeIntensity = isBeingAttacked ? attackIntensity * 8 : 0;
        const attackShakeX = isBeingAttacked ? Math.sin(animationTime * 10) * attackShakeIntensity : 0;
        const attackShakeY = isBeingAttacked ? Math.sin(animationTime * 8) * attackShakeIntensity : 0;

        return (
          <motion.div
            key={`character-${player.id}`}
            className="absolute"
            initial={{ opacity: 1, scale: 1 }}
            animate={{
              opacity: 1,
              scale: isBeingAttacked ? 1.2 : gameMode === "panic" ? 1.8 : 1.6,
              x: charX + attackShakeX,
              y: charY + attackShakeY,
            }}
            transition={{
              opacity: { duration: 0.1 },
              scale: { duration: isBeingAttacked ? 0.1 : 0.2 },
              x: { duration: 0.1 },
              y: { duration: 0.1 },
            }}
            style={{
              zIndex: isZombieTarget ? 40 : 35,
            }}
          >
            <div className="relative flex flex-col items-center">
              {/* Efek aura saat diserang */}
              {isZombieTarget && (
                <motion.div
                  className="absolute -inset-3 rounded-full bg-red-600 opacity-30 blur-lg"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}

              {/* Efek partikel saat diserang */}
              {isZombieTarget &&
                [...Array(3)].map((_, i) => (
                  <motion.div
                    key={`particle-${i}`}
                    className="absolute w-2 h-2 bg-red-500 rounded-full"
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{
                      x: (Math.random() - 0.5) * 30,
                      y: (Math.random() - 0.5) * 30,
                      opacity: 0,
                    }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  />
                ))}

              <motion.div
                animate={{
                  scale: isBeingAttacked ? [1, 1.1, 1] : 1,
                  filter: isZombieTarget
                    ? "brightness(2) contrast(2.2) saturate(2) hue-rotate(15deg) drop-shadow(0 0 10px rgba(255,50,50,0.8))"
                    : gameMode === "panic"
                      ? "brightness(1.2) contrast(1.4) saturate(1.2)"
                      : "brightness(1.1) contrast(1.2)",
                }}
                transition={{ duration: isBeingAttacked ? 0.3 : 0.2 }}
              >
                <Image
                  src={workingPath}
                  alt={character.alt}
                  width={gameMode === "panic" ? 120 : 96}
                  height={gameMode === "panic" ? 120 : 96}
                  className="drop-shadow-2xl"
                  unoptimized
                  style={{
                    imageRendering: "pixelated",
                  }}
                />
              </motion.div>

              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 flex gap-1">
                {[...Array(3)].map((_, heartIndex) => (
                  <Heart
                    key={heartIndex}
                    className={`w-4 h-4 transition-all ${
                      heartIndex < health
                        ? isZombieTarget
                          ? "text-red-600 fill-red-600 animate-pulse"
                          : "text-red-500 fill-red-500"
                        : "text-gray-600 fill-gray-600"
                    }`}
                  />
                ))}
              </div>

              <p className="text-white font-mono text-xs mt-1 text-center">{player.nickname}</p>
              <p className="text-gray-400 font-mono text-xs">kecepatan:{speed}</p>

              {/* Bayangan dinamis */}
              <div
                className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-20 h-4 bg-black rounded-full opacity-30 blur-md"
                style={{
                  transform: `translateX(-50%) scaleX(${0.8 + Math.sin(animationTime * 0.6) * 0.2})`,
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}