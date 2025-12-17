"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Zap, Skull } from "lucide-react"

interface CountdownPhaseProps {
  initialCountdown?: number
  onCountdownComplete: () => void
}

export default function CountdownPhase({ initialCountdown = 10, onCountdownComplete }: CountdownPhaseProps) {
  const [countdown, setCountdown] = useState(initialCountdown)
  const hasCompletedRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    console.log("Starting countdown:", countdown)

    if (hasCompletedRef.current) {
      console.log("Countdown already completed, skipping setup")
      return
    }
// Reset countdown to initial value when initialCountdown changes
    setCountdown(initialCountdown)

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        const nextCount = prev - 1
        console.log("Countdown tick:", nextCount)

        if (nextCount <= 0 && !hasCompletedRef.current) {
          hasCompletedRef.current = true
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          console.log("Countdown complete, calling onCountdownComplete")
          onCountdownComplete()
          return 0
        }
        return nextCount
      })
    }, 1000)

    return () => {
      console.log("Cleaning up countdown timer")
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [initialCountdown, onCountdownComplete])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-black to-purple-950/30 animate-pulse" />

      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-red-500 rounded-full animate-ping opacity-30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 1}s`,
              animationDuration: `${0.8 + Math.random() * 1}s`,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center"
      >
        <div className="flex items-center justify-center mb-6">
          <Skull className="w-12 h-12 text-red-500 mr-4 animate-pulse" />
          <h1 className="text-5xl md:text-7xl  text-white  tracking-wider">PENYIKSAAN DIMULAI</h1>
          <Zap className="w-12 h-12 text-yellow-500 ml-4 animate-bounce" />
        </div>

        <motion.div
          key={countdown}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-8xl md:text-9xl   text-red-500 animate-pulse drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]"
        >
          {countdown}
        </motion.div>

        <p className="text-gray-400 text-lg mt-4 animate-pulse">Bersiaplah untuk melawan zombie!</p>
      </motion.div>

      <style jsx global>{`
        @keyframes pulse-red {
          0%,
          100% {
            text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
          }
          50% {
            text-shadow: 0 0 20px rgba(239, 68, 68, 0.8);
          }
        }
        .animate-pulse {
          animation: pulse-red 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
