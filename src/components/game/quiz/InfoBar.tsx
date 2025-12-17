"use client"

import React from "react"
import { CircleQuestionMark, Clock, Heart, Zap } from "lucide-react"

interface InfoBarProps {
  currentQuestionIndex: number
  totalQuestions: number
  timeLeft: number
  playerHealth: number
  playerSpeed: number
  formatTime: (seconds: number) => string
}

const InfoBar = ({
  currentQuestionIndex,
  totalQuestions,
  timeLeft,
  playerHealth,
  playerSpeed,
  formatTime,
}: InfoBarProps) => {
  return (
    <div className="inline-flex items-center gap-x-5 md:gap-x-6 mx-auto px-4 py-2 mb-5 border border-red-500/30 rounded-full bg-black/40  text-xs md:text-sm">
      <div className="flex items-center gap-x-1">
        <CircleQuestionMark className="w-4 h-4 text-purple-400" />
        <span className="text-white">
          {currentQuestionIndex + 1}/{totalQuestions}
        </span>
      </div>
      <div className="flex items-center gap-x-1">
        <Clock
          className={`w-4 h-4 ${
            timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-yellow-500"
          }`}
        />
        <span
          className={`${
            timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-white"
          }`}
        >
          {formatTime(timeLeft)}
        </span>
      </div>
      <div className="flex items-center gap-x-1">
        {[...Array(3)].map((_, i) => (
          <Heart
            key={i}
            className={`w-4 h-4 transition-all ${
              i < playerHealth
                ? playerHealth <= 1
                  ? "text-red-500 fill-red-500 animate-pulse"
                  : "text-green-500 fill-green-500"
                : "text-gray-600 fill-gray-600"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-x-1">
        <Zap className="w-4 h-4 text-purple-400" />
        <span className="text-white">{playerSpeed} km/h</span>
      </div>
    </div>
  )
}

export default React.memo(InfoBar)