"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { motion, AnimatePresence } from "framer-motion"
import PlayersPanel from "@/components/game/host/PlayersPanel"
import GameBackground from "@/components/game/host/GameBackground"
import ZombieCharacter from "@/components/game/host/ZombieCharacter"
import RunningCharacters from "@/components/game/host/RunningCharacters"
import GameUI from "@/components/game/host/GameUI"
import BackgroundEffects from "@/components/game/host/BackgroundEffects"

interface Player {
  id: string
  nickname: string
  character_type: string
  score: number
  is_alive: boolean
  joined_at: string
}

interface GameRoom {
  id: string
  room_code: string
  title: string
  status: string
  max_players: number
  current_phase: string
  chaser_type: "zombie" | "monster1" | "monster2" | "monster3" | "darknight"
  countdown_start?: string
}

interface PlayerHealthState {
  id: string
  player_id: string
  room_id: string
  health: number
  max_health: number
  speed: number
  is_being_attacked: boolean
  last_attack_time: string
  last_answer_time: string
}

interface PlayerState {
  id: string
  health: number
  maxHealth: number
  speed: number
  isBeingAttacked: boolean
  position: number
  lastAttackTime: number
  attackIntensity: number
  countdown?: number
}

interface ZombieState {
  isAttacking: boolean
  targetPlayerId: string | null
  attackProgress: number
  basePosition: number
  currentPosition: number
}

interface GameCompletion {
  id: string
  player_id: string
  room_id: string
  final_health: number
  correct_answers: number
  total_questions_answered: number
  is_eliminated: boolean
  completion_type: string
  completed_at: string
}

const characterGifs = [
  { src: "/character/character.gif", alt: "Karakter Hijau", color: "bg-green-500", type: "robot1", name: "Hijau" },
  { src: "/character/character1.gif", alt: "Karakter Biru", color: "bg-blue-500", type: "robot2", name: "Biru" },
  { src: "/character/character2.gif", alt: "Karakter Merah", color: "bg-red-500", type: "robot3", name: "Merah" },
  { src: "/character/character3.gif", alt: "Karakter Ungu", color: "bg-purple-500", type: "robot4", name: "Ungu" },
  { src: "/character/character4.gif", alt: "Karakter Oranye", color: "bg-orange-500", type: "robot5", name: "Oranye" },
  { src: "/character/character5.gif", alt: "Karakter Kuning", color: "bg-yellow-500", type: "robot6", name: "Kuning" },
  { src: "/character/character6.gif", alt: "Karakter Abu-abu", color: "bg-gray-500", type: "robot7", name: "Abu-abu" },
  { src: "/character/character7.gif", alt: "Karakter Pink", color: "bg-pink-500", type: "robot8", name: "Pink" },
  { src: "/character/character8.gif", alt: "Karakter Cokelat", color: "bg-brown-500", type: "robot9", name: "Cokelat" },
  { src: "/character/character9.gif", alt: "Karakter Emas", color: "bg-yellow-600", type: "robot10", name: "Emas" },
]

export default function HostGamePage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.roomCode as string

  const [animationTime, setAnimationTime] = useState(0)
  const [gameMode, setGameMode] = useState<"normal" | "panic">("normal")
  const [isClient, setIsClient] = useState(false)
  const [screenWidth, setScreenWidth] = useState(1200)
  const [imageLoadStatus, setImageLoadStatus] = useState<{ [key: string]: boolean }>({})
  const [players, setPlayers] = useState<Player[]>([])
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null)
  const [chaserType, setChaserType] = useState<"zombie" | "monster1" | "monster2" | "monster3" | "darknight">("zombie")
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [completedPlayers, setCompletedPlayers] = useState<Player[]>([])
  const [showCompletionPopup, setShowCompletionPopup] = useState(false)
  const [playerStates, setPlayerStates] = useState<{ [playerId: string]: PlayerState }>({})
  const [playerHealthStates, setPlayerHealthStates] = useState<{ [playerId: string]: PlayerHealthState }>({})
  const [zombieState, setZombieState] = useState<ZombieState>({
    isAttacking: false,
    targetPlayerId: null,
    attackProgress: 0,
    basePosition: 500,
    currentPosition: 500,
  })
  const [attackQueue, setAttackQueue] = useState<string[]>([])
  const [backgroundFlash, setBackgroundFlash] = useState<boolean>(false)
  const [isConnected, setIsConnected] = useState<boolean>(true)
  const attackIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const initializePlayerStates = useCallback((playersData: Player[], healthData: PlayerHealthState[]) => {
    const newStates: { [playerId: string]: PlayerState } = {}
    const newHealthStates: { [playerId: string]: PlayerHealthState } = {}

    playersData.forEach((player, index) => {
      const healthState = healthData.find((h) => h.player_id === player.id)
      const currentHealth = healthState?.health ?? 3
      const currentMaxHealth = healthState?.max_health ?? 3
      const currentSpeed = healthState?.speed ?? 20
      const isBeingAttacked = healthState?.is_being_attacked ?? false
      const lastAttackTime = healthState ? new Date(healthState.last_attack_time).getTime() : 0

      newStates[player.id] = {
        id: player.id,
        health: currentHealth,
        maxHealth: currentMaxHealth,
        speed: currentSpeed,
        isBeingAttacked,
        position: index,
        lastAttackTime,
        attackIntensity: 0,
        countdown: currentSpeed <= 30 && !isBeingAttacked && currentHealth > 0 && player.is_alive ? 10 : undefined,
      }

      if (healthState) {
        newHealthStates[player.id] = healthState
      }
    })

    setPlayerStates(newStates)
    setPlayerHealthStates(newHealthStates)
  }, [])

  const updatePlayerState = useCallback(
    async (playerId: string, updates: Partial<PlayerHealthState>, localUpdates: Partial<PlayerState> = {}) => {
      if (!gameRoom) return

      try {
        const { data: existing, error: fetchError } = await supabase
          .from("player_health_states")
          .select("updated_at")
          .eq("player_id", playerId)
          .eq("room_id", gameRoom.id)
          .single()

        if (fetchError) {
          console.error(`⚠️ Gagal mengambil status pemain ${playerId}:`, fetchError)
          return
        }

        const { error } = await supabase
          .from("player_health_states")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("player_id", playerId)
          .eq("room_id", gameRoom.id)
          .eq("updated_at", existing.updated_at)

        if (error) {
          console.error(`⚠️ Gagal memperbarui status pemain ${playerId}:`, error)
          return
        }

        setPlayerStates((prev) => {
          const current = prev[playerId] || {}
          return {
            ...prev,
            [playerId]: {
              ...current,
              ...localUpdates,
              health: updates.health ?? current.health,
              speed: updates.speed ?? current.speed,
              isBeingAttacked: updates.is_being_attacked ?? current.isBeingAttacked,
              lastAttackTime: Date.now(),
            },
          }
        })
      } catch (error) {
        console.error(`⚠️ Kesalahan saat memperbarui status pemain ${playerId}:`, error)
      }
    },
    [gameRoom]
  )

 const handleZombieAttack = useCallback(
  (playerId: string, newHealth: number, newSpeed: number) => {
    const playerState = playerStates[playerId]
    const player = players.find((p) => p.id === playerId)
    if (!playerState || !player || newHealth < 0 || !player.is_alive) {
      setAttackQueue((prev) => prev.filter((id) => id !== playerId))
      return
    }

    if (zombieState.isAttacking && zombieState.targetPlayerId !== playerId) {
      setAttackQueue((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]))
      return
    }

    if (attackIntervalRef.current) {
      clearInterval(attackIntervalRef.current)
      attackIntervalRef.current = null
    }

    setZombieState({
      isAttacking: true,
      targetPlayerId: playerId,
      attackProgress: 0,
      basePosition: 500,
      currentPosition: 500,
    })

    setBackgroundFlash(true)
    setGameMode("panic")

    updatePlayerState(
      playerId,
      {
        is_being_attacked: true,
      },
      {
        isBeingAttacked: true,
        attackIntensity: 0.5,
        countdown: undefined,
      }
    )

    let progress = 0
    attackIntervalRef.current = setInterval(() => {
      progress += 0.0333
      setZombieState((prev) => ({
        ...prev,
        attackProgress: progress,
        currentPosition: prev.basePosition * (1 - progress * 0.8),
      }))

      if (progress >= 1) {
        clearInterval(attackIntervalRef.current!)
        attackIntervalRef.current = null

        // Kurangi health hanya saat serangan selesai
        updatePlayerState(
          playerId,
          {
            health: newHealth,
            speed: newSpeed,
            is_being_attacked: false,
          },
          {
            health: newHealth,
            speed: newSpeed,
            isBeingAttacked: false,
            attackIntensity: 0,
            countdown: newSpeed <= 30 && newHealth > 0 && player.is_alive ? 10 : undefined,
          }
        )

        setZombieState({
          isAttacking: false,
          targetPlayerId: null,
          attackProgress: 0,
          basePosition: 500,
          currentPosition: 500,
        })

        setBackgroundFlash(false)
        setGameMode("normal")

        setAttackQueue((prev) => {
          const nextQueue = prev.filter((id) => id !== playerId)
          if (nextQueue.length > 0) {
            const nextPlayerId = nextQueue[0]
            const nextState = playerStates[nextPlayerId]
            const nextPlayer = players.find((p) => p.id === nextPlayerId)
            if (nextState && nextState.speed <= 30 && nextState.health > 0 && nextPlayer?.is_alive) {
              setTimeout(() => {
                handleZombieAttack(nextPlayerId, nextState.health - 1, Math.max(20, nextState.speed - 5))
              }, 500)
            }
          }
          return nextQueue
        })
      }
    }, 30)
  },
  [playerStates, players, updatePlayerState, zombieState]
)

  const handleCorrectAnswer = useCallback(
    (playerId: string) => {
      const playerState = playerStates[playerId]
      if (!playerState) return

      const newSpeed = Math.min(playerState.speed + 5, 100)
      updatePlayerState(
        playerId,
        {
          speed: newSpeed,
          is_being_attacked: false,
          last_answer_time: new Date().toISOString(),
        },
        {
          speed: newSpeed,
          isBeingAttacked: false,
          countdown: newSpeed <= 30 ? 10 : undefined,
        }
      )

      if (zombieState.targetPlayerId === playerId && zombieState.isAttacking) {
        clearInterval(attackIntervalRef.current!)
        attackIntervalRef.current = null
        setZombieState({
          isAttacking: false,
          targetPlayerId: null,
          attackProgress: 0,
          basePosition: 500,
          currentPosition: 500,
        })
        setBackgroundFlash(false)
        setGameMode("normal")
      }

      setAttackQueue((prev) => prev.filter((id) => id !== playerId))
    },
    [playerStates, zombieState, updatePlayerState]
  )
const handleWrongAnswer = useCallback(
  (playerId: string) => {
    const playerState = playerStates[playerId]
    if (!playerState) return

    const newSpeed = Math.max(20, playerState.speed - 5)
    updatePlayerState(
      playerId,
      {
        speed: newSpeed,
        last_answer_time: new Date().toISOString(),
      },
      {
        speed: newSpeed,
        // Hanya set countdown jika belum ada, agar tidak mereset
        countdown:
          newSpeed <= 30 && playerState.health > 0 && !playerState.isBeingAttacked && playerState.countdown === undefined
            ? 10
            : playerState.countdown,
      }
    )
  },
  [playerStates, updatePlayerState]
)

  const managePlayerStatus = useCallback(() => {
    if (!gameRoom) return

    setPlayerStates((prev) => {
      const updatedStates = { ...prev }
      const newAttackQueue: string[] = []

      Object.entries(updatedStates).forEach(([playerId, state]) => {
        const player = players.find((p) => p.id === playerId)
        const healthState = playerHealthStates[playerId]
        if (!player || state.health <= 0 || !player.is_alive) {
          updatedStates[playerId] = { ...state, countdown: undefined }
          return
        }

        if (healthState) {
          const timeSinceLastAnswer = (Date.now() - new Date(healthState.last_answer_time).getTime()) / 1000
          if (timeSinceLastAnswer >= 20 && state.speed > 20) {
            const newSpeed = Math.max(20, state.speed - 10)
            updatePlayerState(
              playerId,
              {
                speed: newSpeed,
                last_answer_time: new Date().toISOString(),
              },
              { speed: newSpeed }
            )
          }
        }

        if (state.speed <= 30 && !state.isBeingAttacked && state.health > 0) {
          newAttackQueue.push(playerId)
          if (state.countdown === undefined) {
            updatedStates[playerId] = { ...state, countdown: 10 }
          } else if (state.countdown > 0) {
            updatedStates[playerId] = { ...state, countdown: state.countdown - 1 }
            if (state.countdown <= 1) {
              updatePlayerState(
                playerId,
                {
                  health: state.health - 1,
                  is_being_attacked: true,
                },
                { countdown: undefined }
              )
              handleZombieAttack(playerId, state.health - 1, Math.max(20, state.speed - 5))
            }
          }
        } else {
          updatedStates[playerId] = { ...state, countdown: undefined }
        }
      })

      setAttackQueue(
        newAttackQueue.sort((a, b) => {
          const aTime = new Date(playerHealthStates[a]?.last_answer_time || 0).getTime()
          const bTime = new Date(playerHealthStates[b]?.last_answer_time || 0).getTime()
          return aTime - bTime
        })
      )

      return updatedStates
    })

    // Check if all players are completed or eliminated
    const activePlayers = players.filter((p) => p.is_alive && playerStates[p.id]?.health > 0)
    if (activePlayers.length === 0 && players.length > 0) {
      supabase.from("game_rooms").update({ current_phase: "completed" }).eq("id", gameRoom.id)
      router.push(`/game/${roomCode}/resultshost`)
    }
  }, [gameRoom, playerStates, playerHealthStates, handleZombieAttack, updatePlayerState, players, router, roomCode])

  const fetchGameData = useCallback(async () => {
    if (!roomCode) {
      setLoadingError("Kode ruangan tidak valid")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("*, chaser_type")
        .eq("room_code", roomCode.toUpperCase())
        .single()

      if (roomError || !room) {
        throw new Error("Ruangan tidak ditemukan")
      }
      setGameRoom(room)
      setChaserType(room.chaser_type || "zombie")

      if (room.current_phase === "completed") {
        setIsLoading(false)
        router.push(`/game/${roomCode}/resultshost`)
        return
      }

      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true })

      if (playersError) {
        throw new Error("Gagal mengambil data pemain")
      }
      setPlayers(playersData || [])

      const { data: healthData, error: healthError } = await supabase
        .from("player_health_states")
        .select("*")
        .eq("room_id", room.id)

      if (healthError) {
        throw new Error("Gagal mengambil status kesehatan")
      }
      initializePlayerStates(playersData || [], healthData || [])

      const { data: completionData, error: completionError } = await supabase
        .from("game_completions")
        .select("*, players(nickname, character_type)")
        .eq("room_id", room.id)
        .eq("completion_type", "completed")

      if (completionError) {
        throw new Error("Gagal mengambil data penyelesaian")
      }
      const completed = completionData?.map((completion: any) => completion.players) || []
      setCompletedPlayers(completed)
      if (completed.length > 0) {
        setShowCompletionPopup(true)
      }

      if (playersData && completionData && playersData.length === completionData.length) {
        await supabase.from("game_rooms").update({ current_phase: "completed" }).eq("id", room.id)
        setIsLoading(false)
        router.push(`/game/${roomCode}/resultshost`)
      }
    } catch (error) {
      setLoadingError("Gagal memuat permainan")
      setPlayers([])
      setPlayerStates({})
    } finally {
      setIsLoading(false)
    }
  }, [roomCode, initializePlayerStates, router])

  useEffect(() => {
    if (!gameRoom) return

    const roomChannel = supabase.channel(`room-${gameRoom.id}`)
    const healthChannel = supabase.channel(`health-${gameRoom.id}`)
    const answerChannel = supabase.channel(`answers-${gameRoom.id}`)
    const completionChannel = supabase.channel(`completions-${gameRoom.id}`)
    const playerChannel = supabase.channel(`players-${gameRoom.id}`)

    roomChannel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${gameRoom.id}` },
        (payload) => {
          const newRoom = payload.new as GameRoom
          setGameRoom(newRoom)
          setChaserType(newRoom.chaser_type || "zombie")
          if (newRoom.current_phase === "completed") {
            router.push(`/game/${roomCode}/resultshost`)
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED")
      })

    healthChannel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "player_health_states", filter: `room_id=eq.${gameRoom.id}` },
        (payload) => {
          const healthState = payload.new as PlayerHealthState
          setPlayerHealthStates((prev) => ({
            ...prev,
            [healthState.player_id]: healthState,
          }))
          setPlayerStates((prev) => {
            const current = prev[healthState.player_id] || {}
            return {
              ...prev,
              [healthState.player_id]: {
                ...current,
                health: healthState.health,
                speed: healthState.speed,
                isBeingAttacked: healthState.is_being_attacked,
                lastAttackTime: new Date(healthState.last_answer_time).getTime(),
                countdown:
                  healthState.speed <= 30 && !healthState.is_being_attacked && healthState.health > 0 ? 10 : undefined,
              },
            }
          })
        }
      )
      .subscribe()

    answerChannel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "player_answers", filter: `room_id=eq.${gameRoom.id}` },
        (payload) => {
          const answer = payload.new as any
          if (answer.is_correct) {
            handleCorrectAnswer(answer.player_id)
          } else {
            handleWrongAnswer(answer.player_id)
          }
        }
      )
      .subscribe()

    completionChannel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_completions", filter: `room_id=eq.${gameRoom.id}` },
        async (payload) => {
          const completion = payload.new as GameCompletion
          if (completion.completion_type === "completed") {
            const player = players.find((p) => p.id === completion.player_id)
            if (player) {
              setCompletedPlayers((prev) => {
                if (!prev.some((p) => p.id === player.id)) {
                  return [...prev, player]
                }
                return prev
              })
              setShowCompletionPopup(true)
            }
          }
          const { data, error } = await supabase.from("game_completions").select("*").eq("room_id", gameRoom.id)
          if (!error && data.length === players.length) {
            await supabase.from("game_rooms").update({ current_phase: "completed" }).eq("id", gameRoom.id)
            router.push(`/game/${roomCode}/resultshost`)
          }
        }
      )
      .subscribe()

    playerChannel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players", filter: `room_id=eq.${gameRoom.id}` },
        (payload) => {
          const updatedPlayer = payload.new as Player
          setPlayers((prev) => prev.map((p) => (p.id === updatedPlayer.id ? { ...p, ...updatedPlayer } : p)))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(healthChannel)
      supabase.removeChannel(answerChannel)
      supabase.removeChannel(completionChannel)
      supabase.removeChannel(playerChannel)
    }
  }, [gameRoom, handleCorrectAnswer, handleWrongAnswer, players, router, roomCode])

  useEffect(() => {
    fetchGameData()
  }, [fetchGameData])

  useEffect(() => {
    if (!gameRoom) return
    const interval = setInterval(managePlayerStatus, 1000)
    return () => clearInterval(interval)
  }, [managePlayerStatus, gameRoom])

  useEffect(() => {
    const testAllImages = async () => {
      const status: { [key: string]: boolean } = {}
      for (const character of characterGifs) {
        const works = await testImageLoad(character.src)
        status[character.src] = works
      }
      const chaserFiles = [
        "/images/zombie.gif",
        "/images/monster1.gif",
        "/images/monster2.gif",
        "/images/monster3.gif",
        "/images/darknight.gif",
      ]
      for (const file of chaserFiles) {
        const works = await testImageLoad(file)
        status[file] = works
      }
      setImageLoadStatus(status)
    }
    testAllImages()
  }, [])

  const testImageLoad = (src: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = src
      setTimeout(() => resolve(false), 5000)
    })
  }

  useEffect(() => {
    setIsClient(true)
    setScreenWidth(window.innerWidth)
    const handleResize = () => setScreenWidth(window.innerWidth)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setAnimationTime((prev) => prev + 1), gameMode === "panic" ? 30 : 100)
    return () => clearInterval(interval)
  }, [gameMode])

  useEffect(() => {
    const checkConnection = () => {
      const state = supabase.getChannels()[0]?.state || "closed"
      setIsConnected(state === "joined")
    }
    checkConnection()
    const interval = setInterval(checkConnection, 5000)
    return () => clearInterval(interval)
  }, [])

  const getLoopPosition = (speed: number, spacing: number, offset = 0) => {
    const totalDistance = screenWidth + spacing
    const position = (animationTime * speed + offset) % totalDistance
    return position > 0 ? position - spacing : totalDistance + position - spacing
  }

  const getWorkingImagePath = (character: (typeof characterGifs)[0]) => {
    return imageLoadStatus[character.src] ? character.src : characterGifs[0].src
  }

  const getCharacterByType = (type: string) => {
    return characterGifs.find((char) => char.type === type) || characterGifs[0]
  }

  if (!isClient || isLoading) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">{loadingError ? loadingError : "Memuat Kejaran Pengejar..."}</div>
      </div>
    )
  }

  const centerX = screenWidth / 2

  return (
    <div
      className="relative w-full h-screen bg-black overflow-hidden"
      style={{
        transform: `translate(${Math.sin(animationTime * 0.1) * (gameMode === "panic" ? 5 : 2)}px, ${
          Math.cos(animationTime * 0.1) * (gameMode === "panic" ? 3 : 1)
        }px)`,
      }}
    >
      {!isConnected && (
        <div className="fixed top-4 right-4 bg-red-600 text-white p-2 rounded animate-pulse">
          Koneksi Terputus
        </div>
      )}
      <audio src="/musics/zombies.mp3" autoPlay />
      <audio src="/musics/background-music.mp3" autoPlay loop />
      <AnimatePresence>
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2 max-w-[240px] max-h-[400px] overflow-y-auto custom-scrollbar">
          {Object.entries(playerStates)
            .filter(([_, state]) => state.countdown !== undefined && state.countdown > 0)
            .slice(0, 10)
            .map(([playerId, state]) => {
              const player = players.find((p) => p.id === playerId)
              if (!player) return null
              return (
                <motion.div
                  key={`countdown-${playerId}`}
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="flex items-center bg-red-900/90 text-white font-mono text-sm px-3 py-2 rounded-lg shadow-lg border border-red-500/50 w-[240px] animate-pulse"
                >
                  <span className="flex-1 truncate">{player.nickname}</span>
                  <span className="ml-2 font-bold text-yellow-300">{state.countdown}s</span>
                </motion.div>
              )
            })}
        </div>
      </AnimatePresence>
      <GameBackground
        animationTime={animationTime}
        gameMode={gameMode}
        screenWidth={screenWidth}
        getLoopPosition={getLoopPosition}
      />
      <BackgroundEffects
        animationTime={animationTime}
        gameMode={gameMode}
        screenWidth={screenWidth}
        backgroundFlash={backgroundFlash}
        getLoopPosition={getLoopPosition}
      />
      <PlayersPanel
        players={players}
        gameRoom={gameRoom}
        roomCode={roomCode}
        playerStates={playerStates}
        zombieState={zombieState}
        recentAttacks={new Set<string>()}
        getCharacterByType={getCharacterByType}
        getWorkingImagePath={getWorkingImagePath}
        isConnected={isConnected}
      />
      <RunningCharacters
        players={players}
        playerStates={playerStates}
        playerHealthStates={playerHealthStates}
        zombieState={zombieState}
        animationTime={animationTime}
        gameMode={gameMode}
        centerX={centerX}
        getCharacterByType={getCharacterByType}
        getWorkingImagePath={getWorkingImagePath}
      />
      <ZombieCharacter
        zombieState={zombieState}
        animationTime={animationTime}
        gameMode={gameMode}
        centerX={centerX}
        chaserType={chaserType}
        players={players}
      />
      <GameUI roomCode={roomCode} />
      <AnimatePresence>
        {showCompletionPopup && completedPlayers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowCompletionPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              className="bg-gray-900/90 border border-red-900/50 rounded-lg p-8 max-w-md w-full text-center max-h-[80vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-white font-mono mb-4">Selamat Anda Lolos dari Kejaran!</h2>
              <div className="flex justify-center gap-4 mb-6">
                {completedPlayers.map((player) => {
                  const character = getCharacterByType(player.character_type)
                  return (
                    <img
                      key={player.id}
                      src={getWorkingImagePath(character) || "/placeholder.svg"}
                      alt={character.alt}
                      className="w-16 h-16 object-contain"
                    />
                  )
                })}
              </div>
              <div className="text-white font-mono mb-6">
                <p className="text-lg mb-2">Pemain yang Lolos:</p>
                <ul className="list-disc list-inside">
                  {completedPlayers.map((player) => (
                    <li key={player.id}>{player.nickname}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => {
                  setShowCompletionPopup(false)
                  router.push(`/game/${roomCode}/resultshost`)
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-mono py-2 px-4 rounded"
              >
                Lihat Hasil
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #ff0000 rgba(26, 0, 0, 0.8);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(26, 0, 0, 0.8);
          border-left: 2px solid rgba(255, 0, 0, 0.3);
          box-shadow: inset 0 0 6px rgba(255, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b0000, #ff0000);
          border-radius: 6px;
          border: 2px solid rgba(255, 0, 0, 0.5);
          box-shadow: 0 0 8px rgba(255, 0, 0, 0.7);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #ff0000, #8b0000);
          box-shadow: 0 0 12px rgba(255, 0, 0, 0.9);
        }
      `}</style>
    </div>
  )
}