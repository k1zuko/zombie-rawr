"use client";

import { Heart } from "lucide-react";
import { memo, useMemo } from "react";
import Image from "next/image";

import type { Participant } from "@/app/host/[roomCode]/game/page";
import type { EmbeddedPlayer } from "@/lib/supabase";

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
  screenHeight: number;
  isPortraitMobile: boolean;
  mobileHorizontalShift: number;
}

const characterConfigs = {
  robot1: {
    src: "/character/player/character.webp",
    alt: "Hijau",
    width: 150,
    height: 50,
    verticalOffset: "73%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -150,
  },
  robot2: {
    src: "/character/player/character1-crop.webp",
    alt: "Biru",
    width: 150,
    height: 50,
    verticalOffset: "73%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -150,
  },
  robot3: {
    src: "/character/player/character2-crop.webp",
    alt: "Merah",
    width: 150,
    height: 50,
    verticalOffset: "73%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -150,
  },
  robot4: {
    src: "/character/player/character4-crop.webp",
    alt: "Ungu",
    width: 150,
    height: 50,
    verticalOffset: "73%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -150,
  },
  robot5: {
    src: "/character/player/character5.webp",
    alt: "Oranye",
    width: 150,
    height: 50,
    verticalOffset: "73%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -150,
  },
  robot6: {
    src: "/character/player/character6.webp",
    alt: "Kuning",
    width: 150,
    height: 50,
    verticalOffset: "73%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -150,
  },
  robot7: {
    src: "/character/player/character7-crop.webp",
    alt: "Abu-abu",
    width: 150,
    height: 50,
    verticalOffset: "73%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -150,
  },
  robot8: {
    src: "/character/player/character8-crop.webp",
    alt: "Pink",
    width: 150,
    height: 50,
    verticalOffset: "73%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -150,
  },
  robot9: {
    src: "/character/player/character9-crop.webp",
    alt: "Cokelat",
    width: 150,
    height: 50,
    verticalOffset: "73%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -150,
  },
  robot10: {
    src: "/character/player/character9-crop.webp",
    alt: "Emas",
    width: 150,
    height: 50,
    verticalOffset: "75%",
    horizontalOffset: -900,
    mobileHorizontalOffset: -140, // contoh sedikit variasi
  },
} as const;

const RunningCharacters = memo(function RunningCharacters({
  players,
  playerStates,
  zombieState,
  animationTime,
  gameMode,
  centerX,
  completedPlayers,
  screenHeight,
  isPortraitMobile = false,
  mobileHorizontalShift = 0,
}: RunningCharactersProps) {
  const designHeight = 1080;
  const scaleFactor = Math.max(0.4, screenHeight / designHeight);

  // Sedikit lebih kecil di mobile agar tidak terlalu mendominasi layar sempit
  const mobileScaleMultiplier = isPortraitMobile ? 0.88 : 1.0;
  const effectiveScaleFactor = scaleFactor * mobileScaleMultiplier;

  const activePlayers = useMemo(() => {
    return players.filter((p) => {
      const state = playerStates[p.id];
      if (!state) return false;
      const completed = completedPlayers.some((cp) => cp.player_id === p.id);
      return !completed && p.is_alive && state.health > 0;
    });
  }, [players, playerStates, completedPlayers]);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 35 }}>
      {activePlayers.map((player) => {
        // console.log(`Player ${player.nickname} | isPortraitMobile: ${isPortraitMobile} | centerX: ${centerX} | mobileShift: ${mobileHorizontalShift}`);
        const state = playerStates[player.id];
        if (!state) return null;

        const isTarget = zombieState.targetPlayerId === player.id;
        const config = characterConfigs[player.character_type as keyof typeof characterConfigs] || characterConfigs.robot1;

        // ── Skala ───────────────────────────────────────────────────────
        const baseScale = gameMode === "panic" ? 1.18 : 1.0;
        const targetScale = isTarget ? 1.30 : baseScale;
        const finalScale = targetScale * effectiveScaleFactor;

        // ── Posisi horizontal ──────────────────────────────────────────
        const hOffset = isPortraitMobile
          ? (config.mobileHorizontalOffset ?? -150)
          : config.horizontalOffset;

        let x = centerX + (hOffset * effectiveScaleFactor);

        // Gerakan speed hanya aktif di desktop / landscape
        if (!isPortraitMobile) {
          const baseOffset = 70 * scaleFactor;
          const speedOffset = (state.speed - 5) * 25 * scaleFactor;
          x += baseOffset + speedOffset;
        }

        // Geser tambahan untuk mobile (sama seperti zombie)
        if (isPortraitMobile) {
          x += mobileHorizontalShift;
        }

        // ── Efek getar saat diserang (lebih subtle di mobile) ──────────
        const shakeMult = isPortraitMobile ? 0.55 : 1.0;
        const shakeX = isTarget ? Math.sin(animationTime * 15) * state.attackIntensity * 4 * shakeMult : 0;
        const shakeY = isTarget ? Math.sin(animationTime * 11) * state.attackIntensity * 3 * shakeMult : 0;

        // ── Posisi vertikal ────────────────────────────────────────────
        const MOBILE_BOTTOM_OFFSET = 34; // mirip zombie (30–38), sesuaikan setelah test
        const bottomValue = isPortraitMobile
          ? `${MOBILE_BOTTOM_OFFSET * effectiveScaleFactor}px`
          : config.verticalOffset;

        // ── Container style ────────────────────────────────────────────
        const containerStyle = isPortraitMobile
          ? {
              left: `${x + shakeX}px`,
              bottom: bottomValue,
              transform: `translateY(${shakeY}px)`,
            }
          : {
              left: `${x + shakeX}px`,
              top: bottomValue,
              transform: `translateY(${shakeY}px)`,
            };

        // ── Ukuran info bar lebih kecil & aman di mobile ───────────────
        const infoScale = isPortraitMobile ? Math.min(0.95, effectiveScaleFactor * 0.9) : effectiveScaleFactor;

        return (
          <div
            key={player.id}
            className="absolute origin-bottom"
            style={{
              ...containerStyle,
              zIndex: isTarget ? 42 : 35,
              willChange: "transform, left, bottom",
            }}
          >
            {/* Info bar */}
<div
  className="
    absolute left-1/2 top-1/2
    -translate-x-1/2 -translate-y-[245%]
    flex items-center gap-1.5
    bg-black/85 rounded-full
    border border-white/30
    shadow-sm whitespace-nowrap
    z-50
  "
  style={{
    fontSize: `${Math.round(15 * infoScale)}px`,
    padding: `${Math.round(3 * infoScale)}px ${Math.round(7 * infoScale)}px`,
  }}
>

              <div className="flex gap-0.5">
                {[...Array(player.health.max || 3)].map((_, i) => (
                  <Heart
                    key={i}
                    className={`w-${Math.round(4.5 * infoScale)} h-${Math.round(4.5 * infoScale)} ${
                      i < state.health
                        ? isTarget
                          ? "text-red-500 fill-red-500"
                          : "text-red-400 fill-red-400"
                        : "text-gray-700 fill-gray-700 opacity-50"
                    }`}
                  />
                ))}
              </div>
              <span className="text-white font-medium truncate max-w-[100px]">
                {player.nickname}
              </span>
              <span className="text-gray-400 text-xs">|</span>
              <span className="text-gray-200 font-light text-xs">{state.speed}</span>
            </div>

            {/* Karakter */}
            <Image
              src={config.src}
              alt={config.alt}
              width={config.width}
              height={config.height}
              className="drop-shadow-xl"
              style={{
                imageRendering: "pixelated",
                transform: `scale(${finalScale})`,
                transformOrigin: "bottom center",
                willChange: "transform",
              }}
              priority={isTarget}
            />
          </div>
        );
      })}
    </div>
  );
});

RunningCharacters.displayName = "RunningCharacters";
export default RunningCharacters;