"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skull, Trophy, Crown, Medal, Star, Home, RotateCcw, CheckCircle, XCircle, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"

interface Player {
  id: string
  nickname: string
  health: number
  maxHealth: number
  score: number
  correctAnswers: number
  isHost?: boolean
  character_type?: string
  status?: "alive" | "dead" | "spectating"
  completionTime?: number
  totalQuestions?: number
  isEliminated?: boolean
}

interface HostResultsPhaseProps {
  players: Player[]
  gameLogic: any
  roomCode: string
}

// Character GIF mapping
const characterGifs = [
  "/character/player/character.gif",
  "/character/player/character1.gif",
  "/character/player/character2.gif",
  "/character/player/character3.gif",
  "/character/player/character4.gif",
  "/character/player/character5.gif",
  "/character/player/character6.gif",
  "/character/player/character7.gif",
  "/character/player/character8.gif",
  "/character/player/character9.gif",
]

export default function HostResultsPhase({ players, gameLogic, roomCode }: HostResultsPhaseProps) {
  const [animationPhase, setAnimationPhase] = useState(0)
  const [celebrationText, setCelebrationText] = useState("UJIAN SELESAI!")
  const [showRuangGuruView, setShowRuangGuruView] = useState(false)

  const celebrationTexts = [
    "UJIAN SELESAI!",
    "HASIL TELAH KELUAR!",
    "PENILAIAN BERAKHIR!",
    "SEMUA TELAH DINILAI!",
    "UJIAN SELESAI!",
  ]

  // Sort players by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  const getPlayerStatus = (player: Player) => {
    const accuracy = player.totalQuestions ? (player.correctAnswers / player.totalQuestions) * 100 : 0
    const passed = accuracy >= 60 && !player.isEliminated // 60% threshold for passing
    return {
      passed,
      accuracy: Math.round(accuracy),
      status: passed ? "LOLOS" : "TIDAK LOLOS",
    }
  }

  const getCharacterGif = (characterType: string | undefined) => {
    if (!characterType) return characterGifs[0]
    const index = Number.parseInt(characterType.replace("robot", "")) - 1
    return characterGifs[index] || characterGifs[0]
  }

  const formatCompletionTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  useEffect(() => {
    // Animation phases: 0 = fade in, 1 = results, 2 = actions
    const phaseTimer = setTimeout(
      () => {
        if (animationPhase < 2) {
          setAnimationPhase(animationPhase + 1)
        }
      },
      animationPhase === 0 ? 1500 : 1000,
    )

    return () => clearTimeout(phaseTimer)
  }, [animationPhase])

  useEffect(() => {
    const textInterval = setInterval(() => {
      setCelebrationText(celebrationTexts[Math.floor(Math.random() * celebrationTexts.length)])
    }, 3000)

    return () => clearInterval(textInterval)
  }, [])

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-8 h-8 text-yellow-500" />
      case 1:
        return <Medal className="w-8 h-8 text-gray-400" />
      case 2:
        return <Star className="w-8 h-8 text-amber-600" />
      default:
        return <Skull className="w-8 h-8 text-gray-600" />
    }
  }

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return "bg-yellow-900/30 border-yellow-500/50 shadow-lg shadow-yellow-500/20"
      case 1:
        return "bg-gray-800/30 border-gray-400/50 shadow-lg shadow-gray-400/20"
      case 2:
        return "bg-orange-900/30 border-orange-600/50 shadow-lg shadow-orange-600/20"
      default:
        return "bg-black/40 border-gray-600/30"
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-red-900 opacity-90" />

      {/* Floating celebration particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl"
            initial={{
              x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 1920),
              y: (typeof window !== "undefined" ? window.innerHeight : 1080) + 50,
              opacity: 0,
            }}
            animate={{
              y: -100,
              opacity: [0, 1, 0],
              rotate: [0, 360],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.1,
            }}
          >
            {["🎓", "📚", "⭐", "🏆", "✨"][Math.floor(Math.random() * 5)]}
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Phase 0: Dramatic entrance */}
        {animationPhase >= 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center mb-8"
          >
            {/* Main trophy */}
            <div className="relative mb-8">
              <Trophy className="w-32 h-32 text-yellow-500 mx-auto animate-pulse drop-shadow-[0_0_40px_rgba(234,179,8,0.8)]" />
              <div className="absolute inset-0 w-32 h-32 mx-auto bg-yellow-500/20 rounded-full blur-xl animate-pulse" />
            </div>

            {/* Title */}
            <h1 className="text-6xl font-black mb-4 bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent drop-shadow-lg animate-pulse">
              {celebrationText}
            </h1>

            <p className="text-gray-300 text-xl mb-6">Hasil Ujian dan Papan Skor Akhir</p>

            <div className="flex justify-center gap-4 mb-8">
              <Button
                onClick={() => setShowRuangGuruView(false)}
                className={`px-6 py-2 rounded-lg font-mono transition-all ${
                  !showRuangGuruView
                    ? "bg-orange-600 text-white border-orange-500"
                    : "bg-gray-700 text-gray-300 border-gray-600"
                }`}
              >
                Papan Skor
              </Button>
              <Button
                onClick={() => setShowRuangGuruView(true)}
                className={`px-6 py-2 rounded-lg font-mono transition-all ${
                  showRuangGuruView
                    ? "bg-orange-600 text-white border-orange-500"
                    : "bg-gray-700 text-gray-300 border-gray-600"
                }`}
              >
                Hasil Ujian
              </Button>
            </div>
          </motion.div>
        )}

        {/* Phase 1: Results */}
        {animationPhase >= 1 && (
          <div
            className={`transition-all duration-1000 ${animationPhase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          >
            {showRuangGuruView ? (
              <div className="max-w-7xl mx-auto">
                {/* Header with round info */}
                <div className="text-center mb-8">
                  <div className="inline-block bg-orange-600 text-white px-8 py-3 rounded-full font-bold text-xl mb-4">
                    QUIZ RUSH
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">BABAK 1 - PENGETAHUAN UMUM</h2>
                  <div className="flex justify-center gap-8 mb-6">
                    <Badge className="bg-blue-600 text-white px-4 py-2 text-sm font-bold">JAWABAN TERBAIK</Badge>
                    <Badge className="bg-red-600 text-white px-4 py-2 text-sm font-bold">SELESAI JAWABAN</Badge>
                  </div>
                </div>

                {/* Player grid in Ruang Guru style */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {sortedPlayers.map((player, index) => {
                    const playerStatus = getPlayerStatus(player)
                    const completionTime = player.completionTime || Math.floor(Math.random() * 300) + 60 // Mock time if not available

                    return (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-gray-900/90 rounded-xl border-2 border-gray-700 overflow-hidden hover:border-orange-500 transition-all duration-300"
                      >
                        {/* Player number and photo */}
                        <div className="relative">
                          <div className="absolute top-2 left-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm z-10">
                            {String(index + 1).padStart(2, "0")}
                          </div>

                          {/* Completion time badge */}
                          <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold z-10">
                            DURASI {formatCompletionTime(completionTime)}
                          </div>

                          {/* Player avatar */}
                          <div className="h-32 bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center">
                            <Image
                              src={getCharacterGif(player.character_type) || "/placeholder.svg"}
                              alt={player.nickname}
                              width={80}
                              height={80}
                              className="rounded-full border-2 border-white"
                              unoptimized
                            />
                          </div>
                        </div>

                        {/* Player info */}
                        <div className="p-4">
                          <h3 className="text-white font-bold text-lg mb-1 truncate">{player.nickname}</h3>
                          <p className="text-gray-400 text-sm mb-3">QuizRush | Peserta Ujian</p>

                          {/* Status badge */}
                          <div
                            className={`w-full py-2 px-4 rounded-lg text-center font-bold text-sm ${
                              playerStatus.passed ? "bg-green-600 text-white" : "bg-red-600 text-white"
                            }`}
                          >
                            {playerStatus.status}
                          </div>

                          {/* Stats */}
                          <div className="mt-3 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Benar:</span>
                              <span className="text-white font-bold">
                                {player.correctAnswers}/{player.totalQuestions || 10}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Akurasi:</span>
                              <span className="text-white font-bold">{playerStatus.accuracy}%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Skor:</span>
                              <span className="text-white font-bold">{player.score}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Card className="bg-green-900/30 border-green-500/50">
                    <CardContent className="p-6 text-center">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-white mb-1">
                        {sortedPlayers.filter((p) => getPlayerStatus(p).passed).length}
                      </div>
                      <div className="text-green-400 font-semibold">LOLOS</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-red-900/30 border-red-500/50">
                    <CardContent className="p-6 text-center">
                      <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-white mb-1">
                        {sortedPlayers.filter((p) => !getPlayerStatus(p).passed).length}
                      </div>
                      <div className="text-red-400 font-semibold">TIDAK LOLOS</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-blue-900/30 border-blue-500/50">
                    <CardContent className="p-6 text-center">
                      <Target className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-white mb-1">
                        {Math.round(
                          sortedPlayers.reduce((acc, p) => acc + getPlayerStatus(p).accuracy, 0) / sortedPlayers.length,
                        )}
                        %
                      </div>
                      <div className="text-blue-400 font-semibold">RATA-RATA</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <>
                {/* Winner announcement */}
                {sortedPlayers.length > 0 && (
                  <Card className="max-w-2xl mx-auto mb-8 bg-gray-900/90 border-yellow-500/50 backdrop-blur-sm">
                    <div className="p-8 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-purple-500/10" />

                      <div className="relative z-10 text-center">
                        <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
                        <h2 className="text-3xl font-bold text-white font-mono mb-2">JUARA KELAS</h2>
                        <div className="flex items-center justify-center gap-4 mb-2">
                          <motion.div
                            className="w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-500"
                            animate={{
                              scale: [1, 1.1, 1],
                              rotate: [0, 5, -5, 0],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Number.POSITIVE_INFINITY,
                            }}
                          >
                            <Image
                              src={getCharacterGif(sortedPlayers[0]?.character_type) || "/placeholder.svg"}
                              alt={sortedPlayers[0]?.nickname}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          </motion.div>
                          <p className="text-2xl text-yellow-400 font-mono">{sortedPlayers[0]?.nickname}</p>
                        </div>
                        <p className="text-gray-400 mt-2">
                          Skor: {sortedPlayers[0]?.score} • {sortedPlayers[0]?.correctAnswers || 0} jawaban benar
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Leaderboard */}
                <Card className="bg-black/70 backdrop-blur-xl border border-red-800/50">
                  <CardHeader>
                    <CardTitle className="text-white text-2xl text-center flex items-center justify-center gap-2">
                      <Trophy className="w-6 h-6 text-yellow-400" />
                      Papan Skor Akhir
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {sortedPlayers.map((player, index) => (
                        <motion.div
                          key={player.id}
                          initial={{ opacity: 0, x: -50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`flex items-center justify-between p-4 rounded-xl border-2 backdrop-blur-sm transition-all duration-300 hover:scale-105 ${getRankColor(index)}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                              {getRankIcon(index)}
                              <span className="text-2xl font-bold text-white font-mono">#{index + 1}</span>
                            </div>

                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-500">
                              <Image
                                src={getCharacterGif(player.character_type) || "/placeholder.svg"}
                                alt={player.nickname}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            </div>

                            <div>
                              <div className="text-white font-bold text-lg flex items-center gap-2">
                                {player.nickname}
                                {player.status === "dead" && <Skull className="w-4 h-4 text-red-500" />}
                              </div>
                              <div className="text-gray-400 text-sm">
                                {player.correctAnswers || 0} jawaban benar • {getPlayerStatus(player).accuracy}% akurasi
                              </div>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs text-gray-500">Nyawa:</span>
                                <div className="flex space-x-1">
                                  {[...Array(player.maxHealth)].map((_, i) => (
                                    <div
                                      key={i}
                                      className={`w-2 h-2 rounded-full ${i < player.health ? "bg-red-500" : "bg-gray-600"}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-white font-bold text-2xl">{player.score}</div>
                            <div className="text-gray-400 text-sm">poin</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Phase 2: Action buttons */}
        {animationPhase >= 2 && (
          <div className="text-center space-y-6 animate-fade-in mt-8">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={gameLogic.restartGame}
                className="bg-orange-600 hover:bg-orange-700 text-white font-mono text-lg px-8 py-3 rounded-lg border border-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_30px_rgba(234,88,12,0.5)] transition-all duration-300"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                UJIAN BARU
              </Button>

              <Button
                onClick={() => (window.location.href = "/")}
                className="bg-gray-700 hover:bg-gray-600 text-white font-mono text-lg px-8 py-3 rounded-lg border border-gray-500 shadow-[0_0_20px_rgba(107,114,128,0.3)] hover:shadow-[0_0_30px_rgba(107,114,128,0.5)] transition-all duration-300"
              >
                <Home className="w-5 h-5 mr-2" />
                KEMBALI KE BERANDA
              </Button>
            </div>

            <p className="text-gray-500 text-sm font-mono animate-pulse">Ujian berikutnya menunggu...</p>
          </div>
        )}
      </div>

      {/* Corner magical effects */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-orange-500/20 to-transparent rounded-br-full animate-pulse" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-yellow-500/20 to-transparent rounded-bl-full animate-pulse" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/20 to-transparent rounded-tr-full animate-pulse" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-tl from-orange-500/20 to-transparent rounded-tl-full animate-pulse" />

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
      `}</style>
    </div>
  )
}
