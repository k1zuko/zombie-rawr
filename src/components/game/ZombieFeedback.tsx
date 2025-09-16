"use client";

import { useEffect, useState } from "react";
import { Skull, Zap } from "lucide-react";
import Image from "next/image";
import { useTranslation } from "react-i18next";

interface ZombieFeedbackProps {
  isCorrect: boolean | null;
  isVisible: boolean;
  activeZombie: string | null;
  activePlayer: string | null;
}

export default function ZombieFeedback({ isCorrect, isVisible, activeZombie, activePlayer }: ZombieFeedbackProps) {
  const {t} = useTranslation()
  const [animationKey, setAnimationKey] = useState(0);
  const [showEffects, setShowEffects] = useState(false);

  const zombieOptions = [
  { value: "zombie",    gif: "/character/chaser/zombie.webp" },
  { value: "monster1",  gif: "/character/chaser/monster1.webp" },
  { value: "monster2",  gif: "/character/chaser/monster2.webp" },
  { value: "monster3",  gif: "/character/chaser/monster3.webp" },
  { value: "darknight", gif: "/character/chaser/darknight.webp" },
];

const playerOptions = [
  { value: "robot1", name: "Hijau", gif: "/character/player/character.webp", alt: "Karakter Hijau" },
  { value: "robot2", name: "Biru", gif: "/character/player/character1-crop.webp", alt: "Karakter Biru" },
  { value: "robot3", name: "Merah", gif: "/character/player/character2-crop.webp", alt: "Karakter Merah" },
  { value: "robot4", name: "Ungu", gif: "/character/player/character3-crop.webp", alt: "Karakter Ungu" },
  { value: "robot5", name: "Oranye", gif: "/character/player/character4-crop.webp", alt: "Karakter Oranye" },
  { value: "robot6", name: "Kuning", gif: "/character/player/character5.webp", alt: "Karakter Kuning" },
  { value: "robot7", name: "Abu-abu", gif: "/character/player/character6.webp", alt: "Karakter Abu-abu" },
  { value: "robot8", name: "Pink", gif: "/character/player/character7-crop.webp", alt: "Karakter Pink" },
  { value: "robot9", name: "Cokelat", gif: "/character/player/character8-crop.webp", alt: "Karakter Cokelat" },
  { value: "robot10", name: "Emas", gif: "/character/player/character9-crop.webp", alt: "Karakter Emas" },
]

  const zombieGif =
    zombieOptions.find((z) => z.value === activeZombie)?.gif ??
    zombieOptions[0].gif; // fallback

  const playerGif =
    playerOptions.find((p) => p.value === activePlayer)?.gif ??
    playerOptions[0].gif; // fallback

  useEffect(() => {
    if (isVisible) {
      setAnimationKey((prev) => prev + 1);
      setShowEffects(true);
      const timer = setTimeout(() => setShowEffects(false), 1500); // Sesuaikan dengan FEEDBACK_DURATION
      return () => clearTimeout(timer);
    }
  }, [isVisible, isCorrect]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 border-t border-gray-700 backdrop-blur-sm z-50 shadow-[0_-10px_30px_0_rgba(0,0,0,0.3)]">
      <div className="container mx-auto px-4 py-3">
        <div className="relative h-28 overflow-hidden">
          {/* Jalur latar belakang */}
          <div className="absolute bottom-4 left-0 right-0 h-3 bg-gray-800 rounded-full">
            <div className="absolute h-full w-full bg-gradient-to-r from-transparent via-gray-600/50 to-transparent" />
            {/* Rintangan di jalur */}
            <div className="absolute left-20 bottom-4 w-3 h-5 bg-red-500 rounded-t-md" />
            <div className="absolute left-45% bottom-4 w-4 h-6 bg-yellow-500 rounded-t-md" />
            <div className="absolute left-70% bottom-4 w-5 h-4 bg-blue-500 rounded-t-md" />
          </div>

          {/* Karakter pelari (yang dikejar) */}
          <div
            key={`character-${animationKey}`}
            className={`absolute bottom-4 transition-all ${isCorrect ? "animate-run-fast" : "animate-run-slow"}`}
            style={{
              width: "70px",
              height: "70px",
              animation: isCorrect
                ? "runFast 1.8s cubic-bezier(0.2, 0.8, 0.4, 1) forwards"
                : "runSlow 2.2s ease-out forwards",
            }}
          >
            <Image
              src={playerGif}
              alt="Karakter Pelari"
              width={70}
              height={70}
              unoptimized
              className="object-contain"
              style={{
                filter: isCorrect ? "brightness(1.2) contrast(1.2)" : "brightness(0.8) contrast(1.1)",
              }}
            />
          </div>

          {/* Zombie pengejar */}
          {isCorrect === false && (
            <div
              key={`zombie-${animationKey}`}
              className="absolute bottom-4 animate-float"
              style={{
                width: "80px",
                height: "80px",
                animation: "chaseZombie 2.2s cubic-bezier(0.4, 0.1, 0.2, 1) forwards",
                left: "-80px",
              }}
            >
              <Image
                src={zombieGif}
                alt="Zombie Pengejar"
                width={80}
                height={80}
                unoptimized
                className="object-contain"
                style={{
                  filter: "hue-rotate(-30deg) brightness(1.1) drop-shadow(0 0 4px rgba(255, 0, 0, 0.5))",
                }}
              />
            </div>
          )}

          {/* Teks umpan balik */}
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div className={`flex items-center space-x-2 ${isCorrect ? "text-green-400" : "text-red-400"}`}>
              {isCorrect ? (
                <>
                  <div className="relative">
                    <Zap className="w-5 h-5 animate-pulse" />
                    <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold tracking-wider block">{t("youAreSafe")}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <Skull className="w-5 h-5 animate-pulse" />
                    <div className="absolute inset-0 rounded-full bg-red-400/20 animate-ping" />
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold tracking-wider block">{t("zombieApproaching")}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Efek garis kecepatan */}
          {isCorrect && showEffects && (
            <div className="absolute left-0 right-0 bottom-0 h-full overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="absolute bottom-0 w-1 h-10 bg-white/30"
                  style={{
                    left: `${Math.random() * 100}%`,
                    transform: `rotate(${Math.random() * 30 - 15}deg)`,
                    animation: `speedLine 0.8s ease-out ${i * 0.05}s forwards`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes runFast {
          0% {
            left: -70px;
            transform: scaleX(1) rotate(0deg);
          }
          20% {
            transform: scaleX(1) rotate(-5deg);
          }
          40% {
            transform: scaleX(1) rotate(5deg);
          }
          60% {
            transform: scaleX(1) rotate(-3deg);
          }
          80% {
            transform: scaleX(1) rotate(2deg);
          }
          100% {
            left: calc(100% + 70px);
            transform: scaleX(1) rotate(0deg);
          }
        }
        @keyframes runSlow {
          0% {
            left: -70px;
            transform: scaleX(1);
          }
          30% {
            transform: scaleX(1);
          }
          50% {
            transform: scaleX(1);
          }
          70% {
            transform: scaleX(1);
          }
          100% {
            left: 60%;
            transform: scaleX(1);
          }
        }
        @keyframes chaseZombie {
          0% {
            left: -100px;
            opacity: 0;
            transform: scaleX(1);
          }
          20% {
            opacity: 1;
            transform: scaleX(1);
          }
          40% {
            transform: scaleX(1);
          }
          60% {
            transform: scaleX(1);
          }
          80% {
            transform: scaleX(1);
          }
          100% {
            left: 30%;
            opacity: 1;
            transform: scaleX(1);
          }
        }
        @keyframes speedLine {
          0% {
            opacity: 0.8;
            transform: translateY(0) rotate(15deg);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) rotate(15deg);
          }
        }
        .animate-float {
          animation: float 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}