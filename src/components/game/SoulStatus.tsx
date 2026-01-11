"use client"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface Player {
  id?: string
  player_id?: string
  nickname: string
  character_type?: string
  is_host?: boolean
  isHost?: boolean
}

interface SoulStatusProps {
  player: Player
  isCurrentPlayer?: boolean
  className?: string
}

const characterOptions = [
  { value: "robot1", gif: "/character/player/character.webp" },
  { value: "robot2", gif: "/character/player/character1-crop.webp" },
  { value: "robot3", gif: "/character/player/character2-crop.webp" },
  { value: "robot4", gif: "/character/player/character3-crop.webp" },
  { value: "robot5", gif: "/character/player/character4-crop.webp" },
  { value: "robot6", gif: "/character/player/character5-resize.webp" },
  { value: "robot7", gif: "/character/player/character6.webp" },
  { value: "robot8", gif: "/character/player/character7-crop.webp" },
  { value: "robot9", gif: "/character/player/character8-crop.webp" },
  { value: "robot10", gif: "/character/player/character9-crop.webp" },
]

export default function SoulStatus({
  player,
  isCurrentPlayer = false,
  className,
}: SoulStatusProps) {

  const isHost = player.is_host || player.isHost || false
  const selectedCharacter = characterOptions.find(c => c.value === player.character_type)

  // Tentukan warna nama
  const nameColor = isCurrentPlayer
    ? "text-red-400"           // KAMU → MERAH TERANG
    : isHost
      ? "text-cyan-400"        // HOST → BIRU TERANG
      : "text-red-200"         // LAINNYA → MERAH MUDA / PUTIH

  const borderColor = isCurrentPlayer
    ? "border-red-500 ring-2 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
    : isHost
      ? "border-cyan-500 ring-2 ring-cyan-500/40 shadow-[0_0_20px_rgba(34,211,238,0.5)]"
      : "border-red-900/60 hover:border-red-700 shadow-[0_0_10px_rgba(100,0,0,0.4)]"

  return (
    <Card className={cn(
      "relative overflow-hidden backdrop-blur-sm border-2 bg-black/90 transition-all duration-300",
      borderColor,
      "p-4",
      className
    )}>
      <div className="relative z-10 space-y-4 text-center">
        {/* Nama Player */}
        <p className={cn(
          "  tracking-wider text-shadow-lg text-xl sm:text-2xl",
          nameColor,
          isCurrentPlayer && "drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]",
          isHost && "drop-shadow-[0_0_10px_rgba(34,211,238,0.7)]"
        )}>
          {player.nickname}
        </p>

        {/* Karakter GIF */}
        {selectedCharacter && (
          <div className="flex justify-center">
            <Image
              src={selectedCharacter.gif}
              alt="Character"
              width={240}
              height={240}
              unoptimized
              className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain drop-shadow-2xl"
            />
          </div>
        )}
      </div>
    </Card>
  )
}