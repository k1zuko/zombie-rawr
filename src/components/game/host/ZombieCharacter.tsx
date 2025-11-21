"use client";

import { EmbeddedPlayer } from "@/lib/supabase";
import Image from "next/image";
import { useMemo } from "react";
import React from "react";

interface ZombieState {
  isAttacking: boolean;
  targetPlayerId: string | null;
  attackProgress: number;
  basePosition: number;
  currentPosition: number;
}

interface ZombieCharacterProps {
  zombieState: ZombieState;
  animationTime: number;
  gameMode: "normal" | "panic";
  centerX: number;
  chaserType: string;
  players: EmbeddedPlayer[];
}

const chaserImages = {
  zombie: {
    src: "/character/chaser/zombie.webp",
    alt: "Zombie",
    width: 150,
    height: 50,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
  monster1: {
    src: "/character/chaser/monster1.webp",
    alt: "Mutant Gila",
    width: 150,
    height: 60,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
  monster2: {
    src: "/character/chaser/monster2.webp",
    alt: "Monster Rawa",
    width: 150,
    height: 75,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
  monster3: {
    src: "/character/chaser/monster3.webp",
    alt: "Samurai Gila",
    width: 150,
    height: 65,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
  darknight: {
    src: "/character/chaser/darknight.webp",
    alt: "Ksatria Gelap",
    width: 150,
    height: 70,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
};

const ZombieCharacter = React.memo(
  ({ zombieState, animationTime, gameMode, centerX, chaserType }: ZombieCharacterProps) => {
    const selectedChaser = chaserImages[chaserType as keyof typeof chaserImages] || chaserImages.zombie;
    const ATTACK_DISTANCE = 50;

    // ✅ Memoisasi gerakan & transform
    const { x, y, rotation, scale, filter } = useMemo(() => {
      const isAttacking = zombieState.isAttacking;
      const attackProgress = isAttacking ? zombieState.attackProgress : 0;

      const movementX = attackProgress * ATTACK_DISTANCE;
      const currentScale = isAttacking
        ? gameMode === "panic" ? 2.0 : 1.8
        : gameMode === "panic" ? 1.8 : 1.6;

      return {
        x: movementX,
        y: 0,
        rotation: 0,
        scale: currentScale,
        filter: "none",
      };
    }, [zombieState.isAttacking, zombieState.attackProgress, animationTime, gameMode]);

    return (
      <div
        className="absolute z-40 origin-bottom"
        style={{
          left: `${centerX - zombieState.currentPosition + x + selectedChaser.horizontalOffset}px`,
          top: selectedChaser.verticalOffset,
          transform: `translateY(${y}px)`,
          filter,
          willChange: "transform, filter",
        }}
      >
        <div className="relative">
          {/* ✅ Gambar pengejar — tanpa Framer Motion */}
          <Image
            src={selectedChaser.src}
            alt={selectedChaser.alt}
            width={selectedChaser.width}
            height={selectedChaser.height}
            className="drop-shadow-xl"
            loading="lazy"
            style={{
              imageRendering: "pixelated",
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: "bottom center",
              willChange: "transform",
            }}
          />
        </div>
      </div>
    );
  }
);

ZombieCharacter.displayName = "ZombieCharacter";
export default ZombieCharacter;