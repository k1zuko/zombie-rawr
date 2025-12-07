"use client";

import { Participant } from "@/app/host/[roomCode]/game/page";
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
  players: Participant[];
  screenHeight: number;
  isPortraitMobile: boolean;
  mobileHorizontalShift: number; // New prop for mobile horizontal adjustment
}

const chaserImages = {
  zombie: {
    src: "/character/chaser/zombie.webp",
    alt: "Zombie",
    width: 150,
    height: 50,
    verticalOffset: "75%",
    horizontalOffset: -150,
  },
  monster1: {
    src: "/character/chaser/monster1.webp",
    alt: "Mutant Gila",
    width: 165,
    height: 60,
    verticalOffset: "80%",
    horizontalOffset: -150,
  },
  monster2: {
    src: "/character/chaser/monster2.webp",
    alt: "Monster Rawa",
    width: 150,
    height: 75,
    verticalOffset: "75%",
    horizontalOffset: -150,
  },
  monster3: {
    src: "/character/chaser/monster3.webp",
    alt: "Samurai Gila",
    width: 150,
    height: 65,
    verticalOffset: "75%",
    horizontalOffset: -150,
  },
  darknight: {
    src: "/character/chaser/darknight.webp",
    alt: "Ksatria Gelap",
    width: 150,
    height: 70,
    verticalOffset: "75%",
    horizontalOffset: -150,
  },
};

// You can adjust this value to change the zombie's vertical position on mobile
const MOBILE_BOTTOM_OFFSET = 30; // Pixels from the bottom of the screen

const ZombieCharacter = React.memo(
  ({
    zombieState,
    animationTime,
    gameMode,
    centerX,
    chaserType,
    screenHeight,
    isPortraitMobile,
    mobileHorizontalShift, // Destructure new prop
  }: ZombieCharacterProps) => {
    const selectedChaser = chaserImages[chaserType as keyof typeof chaserImages] || chaserImages.zombie;

    const designHeight = 1080;
    const scaleFactor = Math.max(0.4, screenHeight / designHeight);
    const ATTACK_DISTANCE_SCALED = 50 * scaleFactor;

    const { x, y, rotation, scale, filter } = useMemo(() => {
      const isAttacking = zombieState.isAttacking;
      const attackProgress = isAttacking ? zombieState.attackProgress : 0;

      const movementX = attackProgress * ATTACK_DISTANCE_SCALED;
      const baseScale = isAttacking
        ? gameMode === "panic" ? 2.0 : 1.8
        : gameMode === "panic" ? 1.8 : 1.6;

      return {
        x: movementX,
        y: 0,
        rotation: 0,
        scale: baseScale * scaleFactor,
        filter: "none",
      };
    }, [zombieState.isAttacking, zombieState.attackProgress, animationTime, gameMode, scaleFactor, ATTACK_DISTANCE_SCALED]);

    const finalHorizontalOffset = selectedChaser.horizontalOffset * scaleFactor;
    
    // Use a different positioning style for mobile
    const positionStyle = isPortraitMobile
      ? {
          // New, simplified logic for mobile
          left: `${centerX + x + finalHorizontalOffset + mobileHorizontalShift}px`,
          bottom: `${MOBILE_BOTTOM_OFFSET * scaleFactor}px`,
        }
      : {
          // Old logic for desktop
          left: `${centerX - zombieState.currentPosition + x + selectedChaser.horizontalOffset}px`,
          top: selectedChaser.verticalOffset,
        };

    return (
      <div
        className="absolute z-40 origin-bottom"
        style={{
          ...positionStyle,
          transform: `translateY(${y}px)`,
          filter,
          willChange: "transform, filter",
        }}
      >
        <div className="relative">
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