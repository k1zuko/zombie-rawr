"use client"

import Image from "next/image"
import { Cloud } from "lucide-react"

interface GameBackgroundProps {
  animationTime: number
  gameMode: "normal" | "panic"
  screenWidth: number
  getLoopPosition: (speed: number, spacing: number, offset?: number) => number
}

export default function GameBackground({
  animationTime,
  gameMode,
  screenWidth,
  getLoopPosition,
}: GameBackgroundProps) {
  return (
    <>
      {/* Background Clouds */}
      <div className="absolute inset-0 z-0">
        {[...Array(6)].map((_, i) => (
          <div
            key={`cloud-${i}`}
            className="absolute opacity-30"
            style={{
              left: `${getLoopPosition(gameMode === "panic" ? -2 : -0.8, 180, i * 180)}px`,
              top: `${30 + i * 25}px`,
              transform: `translateX(-50%) scale(${0.8 + Math.sin(animationTime * 0.1 + i) * 0.3})`,
            }}
          >
            <Cloud className="w-20 h-20 text-gray-400 drop-shadow-lg" />
          </div>
        ))}
      </div>

      {/* Full Moon */}
      <div className="absolute top-10 right-20 z-1">
        <Image
          src="/map1/full-moon.png"
          alt="Full Moon"
          width={120}
          height={120}
          unoptimized
          className="opacity-80"
          style={{
            filter:
              gameMode === "panic" ? "brightness(1.2) contrast(1.3) hue-rotate(10deg)" : "brightness(1) contrast(1.1)",
            transform: `scale(${1 + Math.sin(animationTime * 0.05) * 0.1})`,
          }}
        />
      </div>

      {/* Dark Storm Clouds */}
      <div className="absolute inset-0 z-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={`storm-cloud-${i}`}
            className="absolute opacity-60"
            style={{
              left: `${((animationTime * (gameMode === "panic" ? -1.5 : -0.5) + i * 350) % (screenWidth + 400)) - 200}px`,
              top: `${20 + i * 40}px`,
              transform: `scale(${0.8 + Math.sin(animationTime * 0.02 + i) * 0.3}) scaleX(${i % 2 === 0 ? 1 : -1})`,
            }}
          >
            <Image
              src="/map1/dark-clouds.png"
              alt="Storm Cloud"
              width={300}
              height={200}
              className="opacity-70"
              unoptimized
              style={{
                filter:
                  gameMode === "panic"
                    ? "brightness(0.6) contrast(1.4) saturate(0.8)"
                    : "brightness(0.8) contrast(1.2) saturate(0.9)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Far Background - Church & Houses */}
      <div className="absolute bottom-60 left-0 right-0 z-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={`building-${i}`}
            className="absolute opacity-40"
            style={{
              left: `${getLoopPosition(gameMode === "panic" ? -1 : -0.5, 400, i * 400)}px`,
              bottom: "0px",
              transform: `translateX(-50%) scale(${0.5 + Math.sin(animationTime * 0.01 + i) * 0.1})`,
            }}
          >
            <Image
              src={i === 1 ? "/map1/church-silhouette.png" : "/map1/old-house.png"}
              alt="Building"
              width={i === 1 ? 120 : 150}
              height={i === 1 ? 120 : 180}
              className="opacity-60"
              unoptimized
              style={{
                filter: "brightness(0.8) contrast(1.2) invert(1)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Far Background Trees (Spooky Tree) */}
      <div className="absolute bottom-40 left-0 right-0 z-5">
        {[...Array(12)].map((_, i) => (
          <div
            key={`far-tree-${i}`}
            className="absolute opacity-50"
            style={{
              left: `${((animationTime * (gameMode === "panic" ? -2 : -1) + i * 250) % (screenWidth + 500)) - 200}px`,
              bottom: "0px",
              transform: `translateX(-50%) scale(${0.6 + Math.sin(animationTime * 0.02 + i) * 0.1})`,
            }}
          >
            <Image
              src="/map1/spooky-tree-2.png"
              unoptimized
              alt="Spooky Tree"
              width={200}
              height={250}
              className="opacity-70"
              style={{
                filter: "brightness(0.9) contrast(1.3)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Mid Background - Tombstones */}
      <div className="absolute bottom-25 left-0 right-0 z-8">
        {[...Array(8)].map((_, i) => (
          <div
            key={`tombstone-${i}`}
            className="absolute opacity-60"
            style={{
              left: `${getLoopPosition(gameMode === "panic" ? -4 : -1.5, 200, i * 200)}px`,
              bottom: "0px",
              transform: `translateX(-50%) scale(${0.4 + Math.sin(animationTime * 0.03 + i) * 0.1}) scaleX(${i % 2 === 0 ? 1 : -1})`,
            }}
          >
            <Image
              src="/map1/tombstone.png"
              alt="Tombstone"
              width={60}
              unoptimized
              height={80}
              className="opacity-80"
              style={{
                filter: "brightness(0.7) contrast(1.5) saturate(0)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Mid Background Trees (Dead Trees) */}
      <div className="absolute bottom-32 left-0 right-0 z-10">
        {[...Array(16)].map((_, i) => (
          <div
            key={`mid-tree-${i}`}
            className="absolute opacity-70"
            style={{
              left: `${((animationTime * (gameMode === "panic" ? -5 : -2) + i * 120) % (screenWidth + 300)) - 150}px`,
              bottom: "0px",
              transform: `translateX(-50%) scale(${0.8 + Math.sin(animationTime * 0.03 + i) * 0.15}) scaleX(${i % 2 === 0 ? 1 : -1})`,
            }}
          >
            <Image
              src="/map1/dead-tree.png"
              alt="Dead Tree"
              width={150}
              height={200}
              unoptimized
              className="opacity-80"
              style={{
                filter: "brightness(1) contrast(1.2)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Foreground - Old Fence */}
      <div className="absolute bottom-15 left-0 right-0 z-18">
        {[...Array(12)].map((_, i) => (
          <div
            key={`fence-${i}`}
            className="absolute opacity-80"
            style={{
              left: `${getLoopPosition(gameMode === "panic" ? -12 : -4, 100, i * 100)}px`,
              bottom: "0px",
              transform: `translateX(-50%) scale(${0.6 + Math.sin(animationTime * 0.04 + i) * 0.1})`,
            }}
          >
            <Image
              src="/map1/old-fence.png"
              alt="Old Fence"
              width={120}
              height={80}
              className="opacity-90"
              unoptimized
              style={{
                filter: "brightness(0.8) contrast(1.4)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Foreground Trees (Mixed) */}
      <div className="absolute bottom-20 left-0 right-0 z-15">
        {[...Array(20)].map((_, i) => (
          <div
            key={`front-tree-${i}`}
            className="absolute opacity-90"
            style={{
              left: `${((animationTime * (gameMode === "panic" ? -10 : -3) + i * 100) % (screenWidth + 200)) - 120}px`,
              bottom: "0px",
              transform: `translateX(-50%) scale(${0.9 + Math.sin(animationTime * 0.05 + i) * 0.2}) scaleX(${i % 3 === 0 ? -1 : 1})`,
            }}
          >
            <Image
              src={i % 2 === 0 ? "/map1/dead-tree.png" : "/map1/spooky-tree-2.png"}
              alt="Horror Tree"
              width={i % 2 === 0 ? 120 : 160}
              height={i % 2 === 0 ? 160 : 200}
              unoptimized
              className="opacity-95"
              style={{
                filter: "brightness(1.1) contrast(1.1)",
              }}
            />
          </div>
        ))}
      </div>
    </>
  )
}