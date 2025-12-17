"use client"

import React from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import type { EmbeddedPlayer } from "@/lib/supabase"

interface PlayerStatusProps {
  currentPlayer: EmbeddedPlayer
  players: EmbeddedPlayer[]
  hasAnswered?: boolean
  selectedAnswer?: number | null
  currentQuestion?: any
  isSoloMode?: boolean
  wrongAnswers?: number
}

const characterEmojis = {
  robot1: "👻",
  robot2: "🧟",
  robot3: "💀",
  robot4: "🎃",
}

const PlayerStatus = React.memo(function PlayerStatus({
  currentPlayer,
  players,
  hasAnswered = false,
  selectedAnswer = null,
  currentQuestion = null,
  isSoloMode = false,
  wrongAnswers = 0,
}: PlayerStatusProps) {
  const isCaught = false // This would come from gameLogic

  return (
    <Card className="bg-black/60 backdrop-blur-xl border border-red-800/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="text-3xl filter drop-shadow-lg"
              animate={{
                rotate: hasAnswered ? [0, 360] : [0, 10, -10, 0],
                filter: hasAnswered
                  ? [
                      "drop-shadow(0 0 10px rgba(0, 255, 0, 0.5))",
                      "drop-shadow(0 0 20px rgba(0, 255, 0, 0.8))",
                      "drop-shadow(0 0 10px rgba(0, 255, 0, 0.5))",
                    ]
                  : isCaught
                    ? [
                        "drop-shadow(0 0 10px rgba(255, 0, 0, 0.5))",
                        "drop-shadow(0 0 20px rgba(255, 0, 0, 0.8))",
                        "drop-shadow(0 0 10px rgba(255, 0, 0, 0.5))",
                      ]
                    : [
                        "drop-shadow(0 0 5px rgba(255, 255, 255, 0.3))",
                        "drop-shadow(0 0 10px rgba(255, 0, 0, 0.5))",
                        "drop-shadow(0 0 5px rgba(255, 255, 255, 0.3))",
                      ],
              }}
              transition={{
                duration: hasAnswered ? 0.5 : 2,
                repeat: hasAnswered ? 0 : Number.POSITIVE_INFINITY,
              }}
            >
              {characterEmojis[currentPlayer.character_type as keyof typeof characterEmojis]}
            </motion.div>
            <div>
              <div className="text-white  text-lg">{currentPlayer.nickname}</div>
              <div className="text-gray-400 text-sm flex items-center gap-4">
                <span>{currentPlayer.correct_answers} jiwa diselamatkan</span>
                <span>•</span>
                <span>Rank #{players.findIndex((p) => p.player_id === currentPlayer.player_id) + 1}</span>
                {currentPlayer.power_ups > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-400">⚡ {currentPlayer.power_ups}</span>
                  </>
                )}
                {isSoloMode && (
                  <>
                    <span>•</span>
                    <span className="text-red-400">💀 {wrongAnswers}/5</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <motion.div
              className="text-white  text-2xl"
              animate={{
                scale: hasAnswered && selectedAnswer === currentQuestion?.correct ? [1, 1.2, 1] : 1,
              }}
            >
              {currentPlayer.score}
            </motion.div>
            <div className="text-gray-400 text-sm">poin</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default PlayerStatus
