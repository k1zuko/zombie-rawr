"use client"

import { useEffect, useState } from "react"
import { Skull, Eye, Zap } from "lucide-react"

export default function LoadingScreen() {
  const [dots, setDots] = useState("")
  const [glitchText, setGlitchText] = useState("LOADING") // Default statis untuk server
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    // Aktifkan rendering klien
    setIsClient(true)

    // Animasi titik-titik
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)

    // Animasi glitch hanya di klien
    const glitchInterval = setInterval(() => {
      const glitchChars = ["L0AD1NG", "L04D1N6", "LOADING", "L∅∆D1NG", "LØ∆ÐING"]
      setGlitchText(glitchChars[Math.floor(Math.random() * glitchChars.length)])
    }, 200)

    return () => {
      clearInterval(interval)
      clearInterval(glitchInterval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-black to-purple-950/20" />

      {/* Floating particles (hanya dirender di klien) */}
      {isClient && (
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-red-500/30 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main loading content */}
      <div className="text-center z-10 space-y-8">
        {/* Skull icon with glow */}
        <div className="relative">
          <Skull className="w-24 h-24 text-red-500 mx-auto animate-pulse drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
          <div className="absolute inset-0 w-24 h-24 mx-auto">
            <Eye className="w-6 h-6 text-yellow-400 absolute top-6 left-7 animate-ping" />
            <Eye
              className="w-6 h-6 text-yellow-400 absolute top-6 right-7 animate-ping"
              style={{ animationDelay: "0.5s" }}
            />
          </div>
        </div>

        {/* Glitch loading text */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white font-mono tracking-wider">
            <span className="inline-block animate-pulse text-red-500">{glitchText}</span>
            <span className="text-red-400">{dots}</span>
          </h1>

          {/* Loading bar */}
          <div className="w-64 h-2 bg-gray-800 rounded-full mx-auto overflow-hidden border border-red-900/50">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"
              style={{ width: "100%", animation: "loading 2s ease-in-out infinite" }}
            />
          </div>
        </div>

        {/* Atmospheric text */}
        <p className="text-gray-400 text-sm font-mono tracking-wide animate-pulse"> forces...</p>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-4 left-4">
        <Zap className="w-6 h-6 text-purple-500 animate-pulse" />
      </div>
      <div className="absolute top-4 right-4">
        <Zap className="w-6 h-6 text-purple-500 animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
      <div className="absolute bottom-4 left-4">
        <Zap className="w-6 h-6 text-purple-500 animate-pulse" style={{ animationDelay: "0.5s" }} />
      </div>
      <div className="absolute bottom-4 right-4">
        <Zap className="w-6 h-6 text-purple-500 animate-pulse" style={{ animationDelay: "1.5s" }} />
      </div>

      <style jsx>{`
        @keyframes loading {
          0%, 100% { width: 20%; }
          50% { width: 100%; }
        }
      `}</style>
    </div>
  )
}