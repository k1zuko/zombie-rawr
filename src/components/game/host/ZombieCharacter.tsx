"use client";

import Image from "next/image";
import { useRef, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";

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
    src: "/character/chaser/zombie.gif",
    alt: "Zombie",
    width: 200,
    height: 50,
    verticalOffset: "80%", // Posisi vertikal relatif terhadap tinggi layar
    horizontalOffset: -350, // Offset horizontal dari posisi tengah
  },
  monster1: {
    src: "/character/chaser/monster1.gif",
    alt: "Mutant Gila",
    width: 220,
    height: 60,
    verticalOffset: "80%",
    horizontalOffset: -350,
  },
  monster2: {
    src: "/character/chaser/monster2.gif",
    alt: "Monster Rawa",
    width: 280,
    height: 75,
    verticalOffset: "83%",
    horizontalOffset: -330,
  },
  monster3: {
    src: "/character/chaser/monster3.gif",
    alt: "Samurai Gila",
    width: 210,
    height: 65,
    verticalOffset: "81%",
    horizontalOffset: -360,
  },
  darknight: {
    src: "/character/chaser/darknight.gif",
    alt: "Ksatria Gelap",
    width: 230,
    height: 70,
    verticalOffset: "81%",
    horizontalOffset: -380,
  },
};

export default function ZombieCharacter({
  zombieState,
  animationTime,
  gameMode,
  centerX,
  chaserType,
  players,
}: ZombieCharacterProps) {
  const attackRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const ZOMBIE_SPEED = 30;
  const ATTACK_DISTANCE = 300;

  const selectedChaser = chaserImages[chaserType as keyof typeof chaserImages] || chaserImages.zombie;
  const targetPlayer = zombieState.isAttacking
    ? players.find((p) => p.id === zombieState.targetPlayerId)
    : null;

  // Efek kilatan dan skala saat serangan dimulai
  useEffect(() => {
    if (zombieState.isAttacking) {
      controls.start({
        scale: [1, 1.3, 1.2],
        filter: [
          "brightness(1.4) contrast(1.6) saturate(1.4) drop-shadow(0 0 15px rgba(255,50,50,0.8))",
          "brightness(1.8) contrast(1.8) saturate(1.6) drop-shadow(0 0 20px rgba(255,50,50,1))",
          "brightness(1.4) contrast(1.6) saturate(1.4) drop-shadow(0 0 15px rgba(255,50,50,0.8))",
        ],
        transition: { duration: 0.4, ease: "easeInOut", times: [0, 0.5, 1] },
      });
    } else {
      controls.start({
        scale: 1,
        filter: gameMode === "panic"
          ? "brightness(1.3) contrast(1.5) saturate(1.3)"
          : "brightness(1.1) contrast(1.2)",
        transition: { duration: 0.2 },
      });
    }
  }, [zombieState.isAttacking, gameMode, controls]);

  // Logging untuk debugging
  useEffect(() => {
    console.log("ZombieCharacter render:", {
      chaserType,
      selectedChaser: selectedChaser.src,
      isAttacking: zombieState.isAttacking,
      targetPlayer: targetPlayer?.nickname || "Tidak ada target",
      attackProgress: zombieState.attackProgress,
    });
  }, [chaserType, zombieState.isAttacking, selectedChaser.src, targetPlayer, zombieState.attackProgress]);

  // Pergerakan normal
  const normalMovement = {
    x: Math.sin(animationTime * 0.4) * (gameMode === "panic" ? 140 : 30),
    y: Math.sin(animationTime * 1.0) * (gameMode === "panic" ? 50 : 15),
    rotation: Math.sin(animationTime * (gameMode === "panic" ? 0.3 : 0.15)) * (gameMode === "panic" ? 20 : 12),
    scale: gameMode === "panic" ? 2.0 : 1.8,
  };

  // Pergerakan saat menyerang
  const attackMovement = {
    x: zombieState.attackProgress * ATTACK_DISTANCE,
    y: 0,
    rotation: 0,
    scale: gameMode === "panic" ? 2.2 : 2.0, // Zombie membesar saat menyerang
  };

  const currentMovement = zombieState.isAttacking ? attackMovement : normalMovement;

  return (
    <motion.div
      ref={attackRef}
      className="absolute z-40 origin-bottom"
      style={{
        left: `${centerX - zombieState.currentPosition + currentMovement.x + selectedChaser.horizontalOffset}px`,
        top: selectedChaser.verticalOffset,
        transform: `translateY(${currentMovement.y}px)`,
      }}
      animate={controls}
    >
      <div className="relative">
        {/* Indikator serangan dengan nama pemain */}
        {zombieState.isAttacking && targetPlayer && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-1.5 rounded text-sm text-white animate-pulse border border-red-600 shadow-xl"
          >
            Menyerang {targetPlayer.nickname}!
          </motion.div>
        )}

        {/* Efek darah saat menyerang */}
        {zombieState.isAttacking && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-4 h-12 bg-red-700 animate-drip"
          >
            <div className="absolute bottom-0 w-6 h-6 bg-red-700 rounded-full animate-pulse"></div>
          </motion.div>
        )}

        {/* Efek partikel asap/percikan saat menyerang */}
        {zombieState.isAttacking &&
          [...Array(5)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              initial={{ opacity: 0.6, x: 0, y: 0, scale: 0.5 }}
              animate={{
                opacity: 0,
                x: -30 - i * 10,
                y: (Math.random() - 0.5) * 20,
                scale: 0.2,
              }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
              className="absolute w-4 h-4 bg-red-500/50 rounded-full blur-sm"
            />
          ))}

        {/* Efek gelombang kejut saat serangan dimulai */}
        {zombieState.isAttacking && zombieState.attackProgress < 0.2 && (
          <motion.div
            initial={{ opacity: 0.5, scale: 0.5 }}
            animate={{ opacity: 0, scale: 2 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute -inset-8 rounded-full bg-red-600/30 blur-lg"
          />
        )}

        {/* Gambar pengejar */}
        <motion.div
          key={chaserType}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Image
            src={selectedChaser.src}
            alt={selectedChaser.alt}
            width={selectedChaser.width}
            height={selectedChaser.height}
            className="drop-shadow-xl"
            unoptimized
            style={{
              imageRendering: "pixelated",
              transform: `scale(${currentMovement.scale}) rotate(${currentMovement.rotation}deg)`,
              transformOrigin: "bottom center",
              filter: zombieState.isAttacking
                ? "drop-shadow(0 0 15px rgba(99, 99, 99, 0.8))"
                : "none",
            }}
          />
        </motion.div>

        {/* Jejak pengejar saat menyerang */}
        {zombieState.isAttacking &&
          [...Array(4)].map((_, i) => (
            <motion.div
              key={`trail-${i}`}
              initial={{ opacity: 0.5 - i * 0.1, x: 0 }}
              animate={{ opacity: 0, x: -50 - i * 20 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
              className="absolute top-0 left-0"
            >
              <Image
                src={selectedChaser.src}
                alt={`${selectedChaser.alt} Trail`}
                width={selectedChaser.width * (0.9 - i * 0.1)}
                height={selectedChaser.height * (0.9 - i * 0.1)}
                unoptimized
                style={{
                  imageRendering: "pixelated",
                  filter: "brightness(0.6) contrast(1.2) hue-rotate(20deg)",
                  transform: `scale(${0.9 - i * 0.1})`,
                }}
              />
            </motion.div>
          ))}

        {/* Efek aura dengan cahaya dinamis */}
        <motion.div

          animate={{
            scale: zombieState.isAttacking ? [1, 1.2, 1] : 1,
            opacity: zombieState.isAttacking ? [0.4, 0.6, 0.4] : undefined,
            transition: { duration: 0.6, repeat: zombieState.isAttacking ? Infinity : 0 },
          }}
        />

        {/* Bayangan dinamis */}
        <motion.div
          className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-black/50 rounded-full blur-md"
          animate={{
            scaleX: zombieState.isAttacking ? 1.2 + zombieState.attackProgress * 0.3 : 1,
            opacity: zombieState.isAttacking ? 0.6 : 0.4,
            x: zombieState.isAttacking ? -zombieState.attackProgress * 20 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <style jsx>{`
        @keyframes drip {
          0% {
            height: 0;
            opacity: 1;
          }
          50% {
            height: 12px;
            opacity: 1;
          }
          100% {
            height: 24px;
            opacity: 0;
          }
        }
        .animate-drip {
          animation: drip 0.5s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.9;
          }
          50% {
            opacity: 1;
          }
        }
        .animate-pulse {
          animation: pulse 0.5s infinite;
        }

        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.6;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 1.2s infinite;
        }
      `}</style>
    </motion.div>
  );
}