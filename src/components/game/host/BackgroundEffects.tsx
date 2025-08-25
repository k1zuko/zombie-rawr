"use client";

import Image from "next/image";
import { Zap } from "lucide-react";

interface BackgroundEffectsProps {
  animationTime: number;
  gameMode: "normal" | "panic";
  screenWidth: number;
  backgroundFlash: boolean;
  getLoopPosition: (speed: number, spacing: number, offset?: number) => number;
}

export default function BackgroundEffects({
  animationTime,
  gameMode,
  screenWidth,
  backgroundFlash,
  getLoopPosition,
}: BackgroundEffectsProps) {
  return (
    <>
      {backgroundFlash && (
        <div
          className="absolute inset-0 z-100 pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(255,0,0,0.6) 0%, rgba(255,0,0,0.3) 50%, transparent 100%)`,
            animation: "flash 0.3s ease-in-out 2 alternate",
          }}
        />
      )}
      <div className="absolute inset-0 z-5">
        {[...Array(gameMode === "panic" ? 20 : 10)].map((_, i) => (
          <div
            key={`speedline-${i}`}
            className="absolute w-32 h-0.5 bg-white opacity-20"
            style={{
              left: `${getLoopPosition(gameMode === "panic" ? -25 : -8, 40, i * 40)}px`,
              top: `${80 + i * 15}px`,
              transform: `rotate(-8deg)`,
            }}
          />
        ))}
      </div>
      {gameMode === "panic" && (
        <div className="absolute inset-0 z-5">
          {Math.random() > 0.98 && <div className="absolute inset-0 bg-white opacity-30 animate-pulse" />}
          {[...Array(2)].map(
            (_, i) =>
              Math.random() > 0.99 && (
                <Zap
                  key={`lightning-${i}`}
                  className="absolute w-8 h-8 text-white opacity-60"
                  style={{
                    left: `${Math.random() * screenWidth}px`,
                    top: `${Math.random() * 200}px`,
                  }}
                />
              ),
          )}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 z-25">
        {/* {[...Array(4)].map((_, i) => (
          <div
            key={`ground-fog-${i}`}
            className="absolute bottom-0 opacity-40"
            style={{
              left: `${((animationTime * (-2 - i * 0.3) + i * 200) % (screenWidth + 400)) - 200}px`,
              bottom: "0px",
              transform: `scaleY(${0.6 + Math.sin(animationTime * 0.08 + i) * 0.4}) scaleX(${1.2 + Math.sin(animationTime * 0.05 + i) * 0.3})`,
            }}
          >
            <Image
              src="/images/fog-texture2.png"
              alt="Ground Fog"
              width={400}
              height={150}
              unoptimized
              className="opacity-60"
              style={{
                filter: "brightness(0.7) contrast(1.3)",
              }}
            />
          </div>
        ))} */}
        {/* {[...Array(3)].map((_, i) => (
          <div
            key={`volume-fog-${i}`}
            className="absolute opacity-30"
            style={{
              left: `${((animationTime * (-1.5 - i * 0.2) + i * 300) % (screenWidth + 300)) - 150}px`,
              bottom: `${50 + i * 30}px`,
              transform: `scale(${0.8 + Math.sin(animationTime * 0.06 + i) * 0.4}) rotate(${Math.sin(animationTime * 0.03 + i) * 10}deg)`,
            }}
          >
            <Image
              src="/images/fog-texture1.png"
              alt="Volumetric Fog"
              width={250}
              height={200}
              className="opacity-50"
              unoptimized
              style={{
                filter:
                  gameMode === "panic"
                    ? "brightness(0.8) contrast(1.4) hue-rotate(5deg)"
                    : "brightness(0.9) contrast(1.2)",
              }}
            />
          </div>
        ))} */}
      </div>
      <div className="absolute bottom-16 left-0 right-0 z-25">
        {[...Array(gameMode === "panic" ? 25 : 10)].map((_, i) => (
          <div
            key={`dust-${i}`}
            className="absolute w-2 h-2 bg-gray-400 rounded-full opacity-40"
            style={{
              left: `${getLoopPosition(gameMode === "panic" ? -15 : -5, 30, i * 30)}px`,
              bottom: `${Math.sin(animationTime * 0.8 + i) * 30 + 15}px`,
              transform: `scale(${0.3 + Math.sin(animationTime * 0.5 + i) * 0.7})`,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 z-25">
        {[...Array(gameMode === "panic" ? 15 : 6)].map((_, i) => (
          <div
            key={`debris-${i}`}
            className="absolute w-1 h-4 bg-gray-500 opacity-50"
            style={{
              left: `${getLoopPosition(gameMode === "panic" ? -18 : -6, 60, i * 60)}px`,
              top: `${200 + Math.sin(animationTime * 0.3 + i) * 100}px`,
              transform: `rotate(${animationTime * 2 + i * 45}deg)`,
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-20 z-20">
        {[...Array(20)].map((_, i) => (
          <div
            key={`grass-${i}`}
            className="absolute bottom-0 w-8 h-24 bg-gradient-to-t from-gray-500 via-gray-600 to-transparent opacity-60 rounded-t-lg"
            style={{
              left: `${getLoopPosition(gameMode === "panic" ? -20 : -6, 25, i * 25)}px`,
              transform: `scaleY(${0.7 + Math.sin(animationTime * 0.2 + i) * 0.4}) skewX(${Math.sin(animationTime * 0.1) * 5}deg)`,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 z-50 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black opacity-80" />
        <div
          className="absolute inset-0 bg-white mix-blend-overlay"
          style={{
            opacity: Math.random() * (gameMode === "panic" ? 0.2 : 0.1),
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-60 bg-gradient-to-t from-gray-800 to-transparent opacity-50" />
      </div>
      <div className="absolute inset-0 z-26">
        {[...Array(gameMode === "panic" ? 30 : 15)].map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute w-1 h-1 bg-gray-300 rounded-full opacity-20"
            style={{
              left: `${((animationTime * (-3 - i * 0.1) + i * 50) % (screenWidth + 100)) - 50}px`,
              top: `${100 + Math.sin(animationTime * 0.4 + i) * 200}px`,
              transform: `scale(${0.5 + Math.sin(animationTime * 0.6 + i) * 0.5})`,
            }}
          />
        ))}
        <div
          className="absolute top-10 right-20 w-32 h-32 opacity-10"
          style={{
            background: `radial-gradient(circle, rgba(200,220,255,0.3) 0%, transparent 70%)`,
            transform: `scale(${2 + Math.sin(animationTime * 0.08) * 0.5})`,
          }}
        />
      </div>
    </>
  );
}