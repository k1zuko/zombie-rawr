"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"

export default function LoadingScreen() {
  const [dots, setDots] = useState("")
  const [progress, setProgress] = useState(0)
  const [flicker, setFlicker] = useState(true)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 1))
    }, 80)

    const flickerInterval = setInterval(() => {
      setFlicker((prev) => !prev)
    }, 200) // Even slower for minimalism

    return () => {
      clearInterval(dotsInterval)
      clearInterval(progressInterval)
      clearInterval(flickerInterval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden p-4 pixelated">
      {/* Minimal scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,transparent_49%,rgba(139,0,0,0.02)_50%,transparent_51%,transparent_100%)] bg-repeat-y [background-size:100%_8px]" />
      
      {/* Subtle red vignette */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-red-900/30 via-transparent to-red-900/30" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-red-900/30 via-transparent to-red-900/30" />
      
      {/* Reduced blood drips */}
      {isClient && [...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-0.5 h-3 bg-gradient-to-b from-red-600/80 to-red-900/50 rounded"
          initial={{ y: -10, opacity: 0 }}
          animate={{ 
            y: "100vh", 
            opacity: [0, 0.9, 0]
          }}
          transition={{ 
            duration: 5 + Math.random() * 2, 
            delay: Math.random() * 2,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            left: `${Math.random() * 100}%`,
            top: "0%",
          }}
        />
      ))}

      {/* Main content - more spaced, cleaner */}
      <div className="text-center z-10 space-y-4 w-full max-w-md relative">
        {/* Simplified title */}
        <motion.div
          animate={{ opacity: flicker ? 1 : 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono tracking-widest">
            <span className="text-red-500">LOADING</span>
            <span className="text-red-400 ml-1">{dots}</span>
          </h1>
        </motion.div>

        {/* Clean character scene - zombie left, player right, large sizes */}
        <div className="relative h-36 flex items-end justify-center px-4">
          {/* Minimal ground */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-900/40" />

          {/* Zombie - left, subtle menace */}
          <motion.div
            className="absolute left-8 bottom-0 z-10"
            animate={{
              x: [0, -5, 0],
              y: [0, -4, 0],
              scale: [1, 1.03, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Image
              src="/character/chaser/zombie.webp"
              alt="Zombie Chaser"
              width={150}
              height={150}
              unoptimized
              className="drop-shadow-[0_0_15px_rgba(220,38,38,0.7)]"
              style={{ imageRendering: 'pixelated' }}
            />
          </motion.div>

          {/* Player - right, subtle flee */}
          <motion.div
            className="absolute right-8 bottom-0 z-20"
            animate={{
              x: [0, 4, 0],
              y: [0, -3, 0],
              rotate: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Image
              src="/character/player/character.webp"
              alt="Player"
              width={130}
              height={130}
              unoptimized
              className="drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]"
              style={{ imageRendering: 'pixelated' }}
            />
          </motion.div>

          {/* Subtle heart pulse */}
          <motion.div
            className="absolute top-2 left-1/2 -translate-x-1/2 text-red-500/80 text-xl"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            💓
          </motion.div>
        </div>

        {/* Minimal loading bar */}
        <div className="w-full h-2 bg-gray-900/40 rounded mx-auto overflow-hidden border border-red-900/30">
          <motion.div
            className="h-full bg-red-600/80 rounded"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Short horror text */}
        <p className="text-red-500/60 text-xs font-mono tracking-wide uppercase">
          Shadows stir...
        </p>
      </div>
    </div>
  )
}