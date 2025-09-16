"use client";

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
  players: Array<{ id: string; nickname: string }>;
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
      const rotationDeg = isAttacking ? Math.sin(animationTime * 0.3) * 10 : 0;
      const currentScale = isAttacking
        ? gameMode === "panic" ? 2.0 : 1.8
        : gameMode === "panic" ? 1.8 : 1.6;

      const brightness = isAttacking
        ? "brightness(1.4) contrast(1.4) drop-shadow(0 0 10px rgba(255,50,50,0.6))"
        : gameMode === "panic"
          ? "brightness(1.2) contrast(1.2)"
          : "brightness(1.0) contrast(1.0)";

      return {
        x: movementX,
        y: 0,
        rotation: rotationDeg,
        scale: currentScale,
        filter: brightness,
      };
    }, [zombieState.isAttacking, zombieState.attackProgress, animationTime, gameMode]);

    // ✅ Hanya render efek darah jika benar-benar menyerang
    const renderBloodEffect = zombieState.isAttacking && (
      <>
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-4 h-12 bg-red-700 animate-drip">
          <div className="absolute bottom-0 w-6 h-6 bg-red-700 rounded-full animate-pulse" />
        </div>
        <style jsx>{`
          @keyframes drip { 
            0% { height: 0; opacity: 1; }
            50% { height: 12px; opacity: 1; }
            100% { height: 24px; opacity: 0; }
          }
          .animate-drip {
            animation: drip 0.5s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.9; }
            50% { opacity: 1; }
          }
          .animate-pulse {
            animation: pulse 0.5s infinite;
          }
        `}</style>
      </>
    );

    // ✅ Hanya render bayangan jika menyerang
    const shadowScaleX = zombieState.isAttacking ? 1.2 + zombieState.attackProgress * 0.2 : 1;
    const shadowOpacity = zombieState.isAttacking ? 0.6 : 0.4;

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
          {/* ✅ Efek darah (hanya saat attack) */}
          {renderBloodEffect}

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

          {/* ✅ Bayangan dinamis — tanpa keyframes jika tidak perlu */}
          <div
            className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-black/50 rounded-full blur-md"
            style={{
              transform: `translateX(-50%) scaleX(${shadowScaleX})`,
              opacity: shadowOpacity,
              willChange: "transform, opacity",
              transition: "transform 0.3s ease, opacity 0.3s ease",
            }}
          />
        </div>
      </div>
    );
  }
);

ZombieCharacter.displayName = "ZombieCharacter";
export default ZombieCharacter;