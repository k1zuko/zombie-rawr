"use client";

import { Heart } from "lucide-react";
import { useEffect, useMemo } from "react";
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
  getWorkingImagePath: (character: any) => string;
  completedPlayers: Player[];
}

const characterConfigs = [
  { 
    src: "/character/player/character.gif", 
    alt: "Karakter Hijau", 
    type: "robot1", 
    name: "Hijau", 
    width: 30, 
    height: 48, 
    verticalOffset: 5,
    horizontalOffset: 0
  },
  { 
    src: "/character/player/character1-crop.gif", 
    alt: "Karakter Biru", 
    type: "robot2", 
    name: "Biru", 
    width: 30, 
    height: 50, 
    verticalOffset: -2,
    horizontalOffset: 10
  },
  { 
    src: "/character/player/character2-crop.gif", 
    alt: "Karakter Merah", 
    type: "robot3", 
    name: "Merah", 
    width: 30, 
    height: 46, 
    verticalOffset: 2,
    horizontalOffset: -10
  },
  { 
    src: "/character/player/character3-crop.gif", 
    alt: "Karakter Ungu", 
    type: "robot4", 
    name: "Ungu", 
    width: 30, 
    height: 48, 
    verticalOffset: 0,
    horizontalOffset: 5
  },
  { 
    src: "/character/player/character4-crop.gif", 
    alt: "Karakter Oranye", 
    type: "robot5", 
    name: "Oranye", 
    width: 30, 
    height: 50, 
    verticalOffset: -4,
    horizontalOffset: -5
  },
  { 
    src: "/character/player/character5.gif", 
    alt: "Karakter Kuning", 
    type: "robot6", 
    name: "Kuning", 
    width: 30, 
    height: 48, 
    verticalOffset: 0,
    horizontalOffset: 15
  },
  { 
    src: "/character/player/character6.gif", 
    alt: "Karakter Abu-abu", 
    type: "robot7", 
    name: "Abu-abu", 
    width: 30, 
    height: 46, 
    verticalOffset: 2,
    horizontalOffset: -15
  },
  { 
    src: "/character/player/character7-crop.gif", 
    alt: "Karakter Pink", 
    type: "robot8", 
    name: "Pink", 
    width: 30, 
    height: 50, 
    verticalOffset: -2,
    horizontalOffset: 20
  },
  { 
    src: "/character/player/character8-crop.gif", 
    alt: "Karakter Cokelat", 
    type: "robot9", 
    name: "Cokelat", 
    width: 30, 
    height: 48, 
    verticalOffset: 0,
    horizontalOffset: -20
  },
  { 
    src: "/character/player/character9-crop.gif", 
    alt: "Karakter Emas", 
    type: "robot10", 
    name: "Emas", 
    width:30, 
    height: 52, 
    verticalOffset: -4,
    horizontalOffset: 25
  },
];

export default function RunningCharacters({
  players,
  playerStates,
  playerHealthStates,
  zombieState,
  animationTime,
  gameMode,
  centerX,
  getWorkingImagePath,
  completedPlayers,
}: RunningCharactersProps) {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode as string;



  // utils/gridUtils.ts
// File utilitas untuk fungsi getGridPosition yang digunakan bersama

// (Removed duplicate export of getGridPosition)

  // Gunakan useMemo untuk menghitung pemain aktif
  const activePlayers = useMemo(() => {
    return players.filter((player) => {
      const playerState = playerStates[player.id];
      const healthState = playerHealthStates[player.id];
      const health = playerState?.health ?? healthState?.health ?? 3;
      const isCompleted = completedPlayers.some((cp) => cp.id === player.id);
      const isEliminated = !player.is_alive || health <= 0;
      console.log(
        `Pemain ${player.nickname}: isCompleted=${isCompleted}, isEliminated=${isEliminated}, health=${health}, is_alive=${player.is_alive}`
      );
      return !isCompleted && !isEliminated;
    });
  }, [players, playerStates, playerHealthStates, completedPlayers]);

  useEffect(() => {
    console.log("Active players:", activePlayers.map((p) => p.nickname));
    console.log("Completed players:", completedPlayers.map((p) => p.nickname));
    console.log("Total players:", players.length);

    if (activePlayers.length === 0 && players.length > 0) {
      console.log("Tidak ada pemain aktif tersisa, redirect ke resultshost");
      const redirectTimeout = setTimeout(() => {
        router.push(`/game/${roomCode}/resultshost`);
      }, 1000);
      return () => clearTimeout(redirectTimeout);
    }
  }, [activePlayers, players, router, roomCode]);

  // Fungsi untuk mencari konfigurasi karakter berdasarkan tipe
  const getCharacterByType = (type: string) => {
    return characterConfigs.find((char) => char.type === type) || characterConfigs[0];
  };

  // Fungsi getGridPosition
  const getGridPosition = (index: number, totalPlayers: number) => {
    const playersPerRow = 100;
    const row = Math.floor(index / playersPerRow);
    const col = index % playersPerRow;
    const spacingX = 0;
    const spacingY = 0;
    const offsetX = 300;
    const offsetY = 5;

    return {
      x: offsetX + col * spacingX,
      y: offsetY + row * spacingY,
    };
  };

  return (
    <div className="absolute bottom-50 z-30 w-full">
      {activePlayers.map((player, i) => {
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

        if (isEliminated || isCompleted) {
          console.log(`Skipping render for ${player.nickname} - Eliminated: ${isEliminated}, Completed: ${isCompleted}`);
          return null;
        }

        const { x: gridX, y: gridY } = getGridPosition(i, activePlayers.length);
        const speedOffset = (speed - 5) * 8; // Jarak antar karakter berdasarkan kecepatan
        const charX =
          gridX + speedOffset + Math.sin(animationTime * 0.4 + i) * (gameMode === "panic" ? 15 : 8) + character.horizontalOffset;
        const charY =
          gridY + Math.abs(Math.sin(animationTime * 0.6 + i * 0.5)) * (gameMode === "panic" ? 10 : 5) + character.verticalOffset;
        const attackShakeIntensity = isBeingAttacked ? attackIntensity * 4 : 0;
        const attackShakeX = isBeingAttacked ? Math.sin(animationTime * 10) * attackShakeIntensity : 0;
        const attackShakeY = isBeingAttacked ? Math.sin(animationTime * 8) * attackShakeIntensity : 0;

        return (
<motion.div
  key={`character-${player.id}`}
  className="absolute"
  initial={{ opacity: 1, scale: 1 }}
  animate={{
    opacity: 1,
    scale: isBeingAttacked ? 1.1 : 1.0, // Hilangkan skala untuk mode panic
    x: charX + attackShakeX * 0.5, // Kurangi getaran
    y: charY + attackShakeY * 0.5,
  }}
  transition={{ duration: 0.4, ease: "easeOut" }} // Transisi lebih lambat
  style={{ zIndex: isZombieTarget ? 40 : 35 }}
>
  {/* Hapus efek aura dan partikel jika tidak kritis */}
  {isZombieTarget && isBeingAttacked && (
    <div className="absolute -inset-2 rounded-full bg-red-600 opacity-20 blur-md" /> // Ganti motion dengan div statis
  )}
  {/* Hapus partikel untuk optimasi */}
  {/* {isZombieTarget && [...Array(2)].map(...)} <- Hapus ini */}
  
  {/* Informasi karakter: Sederhanakan without whileHover */}
  <motion.div
    className="absolute -top-1 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-gradient-to-r from-black/90 to-gray-900/90 rounded-full px-2 py-0.5 shadow-md border border-white/10"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 0.9, y: 0 }}
    transition={{ duration: 0.4 }}
    style={{ zIndex: 50 }}
  >
    {/* ... kode heart dan nickname ... */}
  </motion.div>
  
  <motion.div
    animate={{
      scale: isBeingAttacked ? [1, 1.05, 1] : 1, // Kurangi skala
      filter: isZombieTarget ? "brightness(1.2) drop-shadow(0 0 5px rgba(255,50,50,0.5))" : "brightness(1.0)",
    }}
    transition={{ duration: 0.4 }}
  >
    <Image
      src={workingPath}
      alt={character.alt}
      width={character.width * 3.0} // Kurangi ukuran dari 4.3 ke 3.0
      height={character.height * 1.5} // Kurangi ukuran
      className="drop-shadow-xl"
      unoptimized={false} // Hapus unoptimized untuk gunakan optimasi Next.js
      loading="lazy"
      style={{ imageRendering: "pixelated" }}
    />
  </motion.div>
  
  {/* Bayangan: Ganti dengan statis */}
  <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 w-10 h-1.5 bg-black rounded-full opacity-20 blur-sm" />
</motion.div>
        );
      })}
      <style jsx>{`
        .truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}