"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"

export default function LoadingScreen() {
  // Kita tetap pakai state dots, tapi hanya untuk desktop
  const [dots, setDots] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".")
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Red flicker & scanline tetap jalan di semua device */}
      <motion.div className="absolute inset-0 bg-red-900 pointer-events-none"
        animate={{ opacity: [0, 0.45, 0] }}
        transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 2 }}
      />
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, #000 3px, #000 6px)" }}
      />

      <div className="relative">
        {/* Zombie + Player tetap muncul */}
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
          {/* VERSI MOBILE: statis, tanpa goyang, tanpa dots bergerak */}
          <h1 className="sm:hidden text-6xl font-bold text-red-600 tracking-widest font-mono"
            style={{ textShadow: "0 0 20px #ff0000, 4px 4px 0 #000" }}>
            LOADING
          </h1>

          {/* VERSI DESKTOP/TABLET: ada getar + dots animasi */}
          <motion.h1
            className="hidden sm:block text-6xl font-bold text-red-600 tracking-widest font-mono"
            style={{ textShadow: "0 0 20px #ff0000, 4px 4px 0 #000" }}
            animate={{ x: [-4, 4, -4, 4, 0] }}
            transition={{ duration: 0.1, repeat: Infinity }}
          >
            LOADING{dots}
          </motion.h1>

          {/* Teks kecil (bisa kamu hide juga di mobile kalau mau) */}
          <p className="text-sm text-red-500 mt-4 opacity-80 animate-pulse font-mono">
            he's right behind you...
          </p>
        </div>
      </div>
    </div>
  )
}