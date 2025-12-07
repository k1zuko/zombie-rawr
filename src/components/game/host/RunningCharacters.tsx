"use client";

import { Heart } from "lucide-react";
import { useEffect, useMemo, memo, useRef } from "react"; // ✅ Tambahkan useRef
import type { EmbeddedPlayer } from "@/lib/supabase";
import Image from "next/image";
import { Participant } from "@/app/host/[roomCode]/game/page";



interface PlayerState {
  health: number;
  speed: number;
  attackIntensity: number;
}

interface ZombieState {
  targetPlayerId: string | null;
}

interface RunningCharactersProps {
  players: Participant[];
  playerStates: { [playerId: string]: PlayerState };
  zombieState: ZombieState;
  animationTime: number;
  gameMode: "normal" | "panic";
  centerX: number;
  completedPlayers: EmbeddedPlayer[];
}

const characterConfigs = [
  { src: "/character/player/character.webp", alt: "Hijau", type: "robot1", width: 20, height: 48, verticalOffset: 72, horizontalOffset:1 },
  { src: "/character/player/character1-crop.webp", alt: "Biru", type: "robot2", width: 20, height: 50, verticalOffset: 72, horizontalOffset: 1 },
  { src: "/character/player/character2-crop.webp", alt: "Merah", type: "robot3", width: 20, height: 46, verticalOffset: 72, horizontalOffset: 1 },
  { src: "/character/player/character4-crop.webp", alt: "Ungu", type: "robot4", width: 20, height: 48, verticalOffset: 72, horizontalOffset: 1 },
  { src: "/character/player/character5.webp", alt: "Oranye", type: "robot5", width: 15, height: 50, verticalOffset: 72, horizontalOffset: 1 },
  { src: "/character/player/character6.webp", alt: "Kuning", type: "robot6", width: 20, height: 48, verticalOffset: 72, horizontalOffset: 1 },
  { src: "/character/player/character7-crop.webp", alt: "Abu-abu", type: "robot7", width: 20, height: 46, verticalOffset: 72, horizontalOffset: 1 },
  { src: "/character/player/character8-crop.webp", alt: "Pink", type: "robot8", width: 20, height: 50, verticalOffset: 72, horizontalOffset: 1 },
  { src: "/character/player/character9-crop.webp", alt: "Cokelat", type: "robot9", width: 20, height: 48, verticalOffset: 72, horizontalOffset: 1 },
  { src: "/character/player/character9-crop.webp", alt: "Emas", type: "robot10", width: 20, height: 52, verticalOffset: 72, horizontalOffset: 1},
];

// ✅ Memoisasi per karakter — hanya update jika props berubah
const CharacterItem = memo(function CharacterItem({
  player,
  state,
  isZombieTarget,
  gameMode,
  animationTime,
  centerX,
}: {
  player: Participant;
  state: PlayerState;
  isZombieTarget: boolean;
  gameMode: "normal" | "panic";
  animationTime: number;
  centerX: number;
}) {
  const character = useMemo(
    () => characterConfigs.find((c) => c.type === player.character_type) || characterConfigs[0],
    [player.character_type]
  );

  const health = state.health;
  const speed = state.speed;
  const attackIntensity = state.attackIntensity;

  // ✅ Simpan baseOffset per karakter
  const baseOffsetRef = useRef<number | null>(null);

  // ✅ Set baseOffset saat speed === 20 pertama kali
  if (speed === 20 && baseOffsetRef.current === null) {
    baseOffsetRef.current = 200; // ✅ Posisi awal tetap — sesuaikan nilainya!
  }

  // ✅ Fallback jika baseOffset belum diset
  if (baseOffsetRef.current === null) {
    baseOffsetRef.current = 200;
  }

  // ✅ Hitung offset relatif terhadap baseOffset
  const speedOffset = (speed - 5) * 15; // ✅ Diubah dari (speed - 5) * 8
  const charX = baseOffsetRef.current + speedOffset + character.horizontalOffset;
  const charY = character.verticalOffset;

  const attackShakeX = isZombieTarget ? Math.sin(animationTime * 10) * attackIntensity * 4 : 0;
  const attackShakeY = isZombieTarget ? Math.sin(animationTime * 8) * attackIntensity * 4 : 0;

  const finalX = charX + attackShakeX;
  const finalY = charY + attackShakeY;

  // ✅ Skip render jika di luar viewport
  const isVisible = Math.abs(finalX - (centerX - window.innerWidth / 2)) < 1500;
  if (!isVisible) return null;

  const scale = isZombieTarget ? 1.2 : gameMode === "panic" ? 1.3 : 1.1;

  return (
    <div
      key={`character-${player.id}`}
      className="absolute"
      style={{
        transform: `translate(${finalX}px, ${finalY}px) scale(${scale})`,
        zIndex: isZombieTarget ? 40 : 35,
        willChange: "transform",
        transition: "transform 0.1s ease",
      }}
    >
      <div className="relative flex flex-col items-center">
        <div
          className="absolute -top-8 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-black/90 rounded-full px-2.5 py-1 border border-white/10"
          style={{ zIndex: 50 }}
        >
          <div className="flex gap-0.5">
            {[...Array(player.health.max || 3)].map((_, heartIndex) => (
              <Heart
                key={heartIndex}
                className={`w-3.5 h-3.5 ${
                  heartIndex < health
                    ? isZombieTarget
                      ? "text-red-600 fill-red-600"
                      : "text-red-500 fill-red-500"
                    : "text-gray-600 fill-gray-600 opacity-50"
                }`}
              />
            ))}
          </div>
          <span className="text-white font-sans text-[10px] font-medium max-w-[50px] truncate ml-1.5">
            {player.nickname}
          </span>
          <span className="text-gray-200 font-sans text-[10px] font-light">|</span>
          <span className="text-gray-200 font-sans text-[10px] font-light">{speed}</span>
        </div>

        <Image
          src={character.src}
          alt={character.alt}
          width={gameMode === "panic" ? character.width * 4.2 : character.width * 4.3}
          height={gameMode === "panic" ? character.height * 2.1 : character.height * 2.25}
          style={{
            imageRendering: "pixelated",
            willChange: "transform",
          }}
          loading="lazy"
        />
      </div>
    </div>
  );
});

CharacterItem.displayName = "CharacterItem";

// ✅ Komponen utama
function RunningCharacters({
  players,
  playerStates,
  zombieState,
  animationTime,
  gameMode,
  centerX,
  completedPlayers,
}: RunningCharactersProps) {
  // ✅ Memoisasi activePlayers
  const activePlayers = useMemo(() => {
    return players.filter((player) => {
      const state = playerStates[player.id];
      if (!state) return false;
      const isCompleted = completedPlayers.some((cp) => cp.player_id === player.id);
      const isEliminated = !player.is_alive || state.health <= 0;
      return !isCompleted && !isEliminated;
    });
  }, [players, playerStates, completedPlayers]);

  return (
    <div className="absolute bottom-50 z-30 w-full">
      {activePlayers.map((player) => {
        const state = playerStates[player.id];
        if (!state) return null;

        return (
          <CharacterItem
            key={player.id}
            player={player}
            state={state}
            isZombieTarget={zombieState.targetPlayerId === player.id}
            gameMode={gameMode}
            animationTime={animationTime}
            centerX={centerX}
          />
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

export default memo(RunningCharacters);