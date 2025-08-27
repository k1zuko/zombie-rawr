"use client"

import type React from "react"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useGameData, type TransformedRoom, type TransformedGameState } from "@/hooks/useGameData"
import { useGameLogic } from "@/hooks/useGameLogic"
import { supabase } from "@/lib/supabase"
import LoadingScreen from "@/components/game/LoadingScreen"
import LobbyPhase from "@/components/game/LobbyPhase"
import QuizPhase from "@/components/game/QuizPhase"
import AttackOverlay from "@/components/game/AttackOverlay"

interface PlayerHealthState {
  playerId: string
  health: number
  isBeingAttacked: boolean
  lastAttackTime: number
}

function GameWrapper({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-900">{children}</div>
}

function ErrorState({ onRetry, error }: { onRetry: () => void; error?: string }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black opacity-90" />
      <div className="text-center z-10 p-6 bg-gray-800 bg-opacity-80 rounded-lg shadow-xl">
        <p className="text-gray-300 text-lg mb-4">Unable to load game data</p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors duration-200"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

function UnknownPhase({
  phase,
  room,
  gameState,
}: { phase: string; room: TransformedRoom; gameState: TransformedGameState }) {
  return <LoadingScreen />
}

export default function GamePage() {
  const isMountedRef = useRef(true)
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set())
  const router = useRouter()

  const params = useParams()
  const roomCode = params.roomCode as string
  const nickname = (typeof window !== "undefined" && localStorage.getItem("nickname")) || "Unknown"

  const { room, gameState, players, currentPlayer, isLoading, error, isSoloMode, refetch } = useGameData(
    roomCode,
    nickname,
  )

  const gameLogic = useGameLogic({
    room,
    gameState,
    players,
    currentPlayer,
  })

  const { isGameOver, setIsGameOver, wrongAnswers, restartGame, setShowCaptureAnimation } = gameLogic

  const [quizState, setQuizState] = useState({
    health: 3,
    correctAnswers: 0,
    currentIndex: 0,
    isResuming: false,
  })
  const [playerHealthStates, setPlayerHealthStates] = useState<{ [playerId: string]: PlayerHealthState }>({})
  const [isUnderAttack, setIsUnderAttack] = useState(false)
  const [attackAnimation, setAttackAnimation] = useState(false)
  if (typeof window !== "undefined") {
    sessionStorage.setItem("redirectTo", window.location.pathname);
  }

  const safeSetTimeout = useCallback((callback: () => void, delay: number) => {
    if (!isMountedRef.current) return null

    const timeout = setTimeout(() => {
      if (isMountedRef.current) {
        callback()
      }
      timeoutsRef.current.delete(timeout)
    }, delay)
    timeoutsRef.current.add(timeout)
    return timeout
  }, [])

  const safeSetState = useCallback((setter: () => void) => {
    if (isMountedRef.current) {
      setter()
    }
  }, [])

  const saveGameCompletion = useCallback(async () => {
    if (!currentPlayer || !room || !isMountedRef.current) return

    const latestHealth = playerHealthStates[currentPlayer.id]?.health ?? quizState.health
    const isActuallyEliminated = latestHealth <= 0

    try {
      const { error } = await supabase.from("game_completions").upsert({
        player_id: currentPlayer.id,
        room_id: room.id,
        final_health: Math.max(0, latestHealth),
        correct_answers: quizState.correctAnswers,
        total_questions_answered: room.questions?.length ?? quizState.currentIndex + 1,
        is_eliminated: isActuallyEliminated,
        completion_type: isActuallyEliminated ? "eliminated" : "completed",
      })

      if (error) {
        console.error("Failed to save game completion:", error)
      } else {
        console.log(
          `Game completion saved - Player: ${currentPlayer.nickname}, Health: ${latestHealth}, Eliminated: ${isActuallyEliminated}`,
        )
      }
    } catch (err) {
      console.error("Error saving game completion:", err)
    }
  }, [currentPlayer, room, quizState, playerHealthStates])

  const handleHealthStateUpdate = useCallback(
    (payload: any) => {
      if (!isMountedRef.current || !payload.new) return

      const healthData = payload.new
      console.log("🩺 Received health update from host:", healthData)

      safeSetState(() => {
        setPlayerHealthStates((prev) => ({
          ...prev,
          [healthData.player_id]: {
            playerId: healthData.player_id,
            health: healthData.health,
            isBeingAttacked: healthData.is_being_attacked,
            lastAttackTime: new Date(healthData.last_attack_time).getTime(),
          },
        }))
      })

      if (currentPlayer && healthData.player_id === currentPlayer.id && healthData.is_being_attacked) {
        console.log("💀 I am being attacked by zombie!")
        triggerAttackAnimation()
      }
    },
    [currentPlayer, safeSetState]
  )

  const handleAttackEvent = useCallback(
    (payload: any) => {
      if (!isMountedRef.current || !payload.new || !currentPlayer) return

      const attackData = payload.new
      console.log("⚔️ Attack event received:", attackData)

      if (attackData.target_player_id === currentPlayer.id) {
        console.log("💀 Zombie attack confirmed for me!")
        triggerAttackAnimation()

        if (attackData.attack_data?.player_nickname) {
          console.log(`🧟 ${attackData.attack_data.player_nickname} was attacked for wrong answer!`)
        }
      }
    },
    [currentPlayer]
  )

  const triggerAttackAnimation = useCallback(() => {
    if (!isMountedRef.current) return

    console.log("🎬 Starting minimal zombie attack animation!")
    safeSetState(() => {
      setIsUnderAttack(true)
      setAttackAnimation(true)
    })

    safeSetTimeout(() => {
      safeSetState(() => {
        setIsUnderAttack(false)
        setAttackAnimation(false)
      })
      console.log("✅ Zombie attack animation completed")
    }, 2000)
  }, [safeSetState, safeSetTimeout])

  useEffect(() => {
    if (!room || !currentPlayer || !isMountedRef.current) return

    console.log(`🔗 Setting up player health sync for room ${room.id}`)

    const healthChannel = supabase
      .channel(`health-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_health_states",
          filter: `room_id=eq.${room.id}`,
        },
        handleHealthStateUpdate
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`✅ Health channel subscribed for room ${room.id}`)
        } else {
          console.error(`❌ Health channel subscription status: ${status}`)
        }
      })

    const attackChannel = supabase
      .channel(`attacks-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "player_attacks",
          filter: `room_id=eq.${room.id}`,
        },
        handleAttackEvent
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`✅ Attack channel subscribed for room ${room.id}`)
        } else {
          console.error(`❌ Attack channel subscription status: ${status}`)
        }
      })

    return () => {
      console.log("🔌 Cleaning up health subscriptions")
      supabase.removeChannel(healthChannel)
      supabase.removeChannel(attackChannel)
    }
  }, [room, currentPlayer, handleHealthStateUpdate, handleAttackEvent])

  // const handleGameEnd = useCallback(async () => {
  //   if (!isMountedRef.current || !currentPlayer || !room) return

  //   console.log("🚀 [page.tsx] Menangani akhir permainan untuk:", currentPlayer.nickname)

  //   const latestHealth = playerHealthStates[currentPlayer.id]?.health ?? quizState.health
  //   const isActuallyEliminated = latestHealth <= 0

  //   isMountedRef.current = false

  //   await saveGameCompletion()

  //   const lastResult = {
  //     playerId: currentPlayer.id,
  //     nickname: currentPlayer.nickname,
  //     health: Math.max(0, latestHealth),
  //     correct: quizState.correctAnswers,
  //     total: room.questions?.length ?? quizState.currentIndex + 1,
  //     eliminated: isActuallyEliminated,
  //     roomCode: roomCode,
  //   }

  //   try {
  //     localStorage.setItem("lastGameResult", JSON.stringify(lastResult))
  //     console.log("💾 [page.tsx] Hasil disimpan ke localStorage:", lastResult)
  //   } catch (error) {
  //     console.error("Gagal menyimpan hasil ke localStorage:", error)
  //   }

  //   router.push(`/game/${roomCode}/results`)
  // }, [currentPlayer, room, quizState, saveGameCompletion, router, roomCode, playerHealthStates])

  // useEffect(() => {
  //   if (gameState?.phase === "finished" || gameState?.phase === "completed") {
  //     console.log(`🏆 [page.tsx] Permainan berakhir dengan fase: ${gameState.phase}. Mengarahkan...`)
  //     handleGameEnd()
  //   }
  // }, [gameState?.phase, handleGameEnd])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      timeoutsRef.current.clear()
    }
  }, [])

  const memoizedOnProgressUpdate = useMemo(
    () => (progress: { health: number; correctAnswers: number; currentIndex: number }) => {
      setQuizState((prev) => {
        if (
          prev.health === progress.health &&
          prev.correctAnswers === progress.correctAnswers &&
          prev.currentIndex === progress.currentIndex
        ) {
          return prev // Prevent unnecessary state updates
        }
        return { ...prev, ...progress }
      })
    },
    []
  )

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!room || !gameState || error) {
    return <ErrorState onRetry={refetch} error={error || "Unknown error"} />
  }

  const renderGamePhase = () => {
    if (quizState.isResuming && currentPlayer) {
      return (
        <>
          <QuizPhase
            room={room}
            gameState={{ ...gameState, phase: "quiz" }}
            currentPlayer={currentPlayer}
            players={players}
            gameLogic={gameLogic}
            isSoloMode={isSoloMode}
            wrongAnswers={wrongAnswers}
            resumeState={quizState}
            onGameComplete={(result) => {
              setQuizState((prev) => ({
                ...prev,
                health: result.health,
                correctAnswers: result.correct,
                currentIndex: result.total - 1,
                isResuming: false,
              }))
            }}
            onProgressUpdate={memoizedOnProgressUpdate}
          />
          <AttackOverlay isVisible={isUnderAttack} />
        </>
      )
    }

    if (!currentPlayer || !currentPlayer.room_id) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white text-xl mb-4">Player not found</p>
            <p className="text-gray-400 mb-4">Please join the game with a valid nickname</p>
            <button
              onClick={() => (window.location.href = "/")}
              className="px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors duration-200"
            >
              Go Home
            </button>
          </div>
        </div>
      )
    }

    console.log("Rendering phase:", gameState.phase)

    switch (gameState.phase) {
      case "lobby":
        return (
          <LobbyPhase currentPlayer={currentPlayer} players={players} gameLogic={gameLogic} isSoloMode={isSoloMode} />
        )

      case "quiz":
        return (
          <>
            <QuizPhase
              room={room}
              gameState={gameState}
              currentPlayer={currentPlayer}
              players={players}
              gameLogic={gameLogic}
              isSoloMode={isSoloMode}
              wrongAnswers={wrongAnswers}
              onGameComplete={(result) => {
                setQuizState((prev) => ({
                  ...prev,
                  health: result.health,
                  correctAnswers: result.correct,
                  currentIndex: result.total - 1,
                  isResuming: false,
                }))
              }}
              onProgressUpdate={memoizedOnProgressUpdate}
            />
            <AttackOverlay isVisible={isUnderAttack} />
          </>
        )

      case "finished":
        return null // Handled by useEffect redirect

      default:
        return <UnknownPhase phase={gameState.phase} room={room} gameState={gameState} />
    }
  }

  return <GameWrapper>{renderGamePhase()}</GameWrapper>
}