"use client"

import { useEffect, useState, ReactNode } from "react"
import { motion } from "framer-motion"
import Image from "next/image"

interface Props {
  children: ReactNode
  /** Minimal durasi loading dalam ms */
  minDuration?: number
  /** Kalau kamu fetch data di parent, kasih tahu kapan selesai */
  isReady?: boolean
}

export default function LoadingScreen({ 
  children, 
  minDuration = 1000,
  isReady = true 
}: Props) {
  const [dots, setDots] = useState("")
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  // Animasi titik-titik "..."
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".")
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Timer minimal loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true)
    }, minDuration)

    return () => clearTimeout(timer)
  }, [minDuration])

  // Tampilkan loading kalau:
  // - Belum lewat minimal waktu ATAU
  // - Data dari parent belum ready
  const showLoading = !minTimeElapsed || !isReady

  if (showLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden z-50">
        {/* Red flicker */}
        <motion.div 
          className="absolute inset-0 bg-red-900 pointer-events-none"
          animate={{ opacity: [0, 0.45, 0] }}
          transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 2 }}
        />
        {/* Scanline */}
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, #000 3px, #000 6px)" }}
        />

        <div className="relative">
          {/* Karakter */}
          <div className="relative w-80 h-48 flex items-end justify-center">
            <div className="absolute bottom-0 right-30">
              <Image src="/character/chaser/zombie.webp" alt="Zombie" width={240} height={240} className="pixelated drop-shadow-lg" priority />
            </div>
            <div className="absolute bottom-3 right-0">
              <Image src="/character/player/character.webp" alt="Player" width={140} height={140} className="pixelated drop-shadow-lg" priority />
            </div>
          </div>

          {/* Teks Loading */}
          <div className="text-center mt-1">
            <h1 className="sm:hidden text-6xl  text-red-600 tracking-widest "
              style={{ textShadow: "0 0 20px #ff0000, 4px 4px 0 #000" }}>
              LOADING
            </h1>

            <motion.h1
              className="hidden sm:block text-6xl  text-red-600 tracking-widest "
              style={{ textShadow: "0 0 20px #ff0000, 4px 4px 0 #000" }}
              animate={{ x: [-4, 4, -4, 4, 0] }}
              transition={{ duration: 0.1, repeat: Infinity }}
            >
              LOADING{dots}
            </motion.h1>

            <p className="text-sm text-red-500 mt-4 opacity-80 animate-pulse ">
              he's right behind you...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Kalau loading selesai → render children
  return <>{children}</>
}