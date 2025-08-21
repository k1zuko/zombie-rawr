"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

// Export interfaces
export interface TransformedPlayer {
  id: string
  nickname: string
  health: number
  maxHealth: number
  score: number
  correctAnswers: number
  isHost?: boolean
  isReady?: boolean
  hasAnswered?: boolean
  status?: "alive" | "dead" | "spectating"
  character_type?: string
  room_id: string
}

export interface TransformedGameState {
  phase: "lobby" | "quiz" | "minigame" | "finished" | "results" | "waiting" | "completed"
  currentQuestion: number
  timeRemaining: number
  currentCorrectAnswers?: number
  targetCorrectAnswers?: number
}

export interface TransformedRoom {
  code: string
  hostId: string
  id: string
  status: string
  current_phase?: string
  questions?: any[]
}

export function useGameData(roomCode: string | undefined, nickname: string | null) {
  const [room, setRoom] = useState<TransformedRoom | null>(null)
  const [gameState, setGameState] = useState<TransformedGameState | null>(null)
  const [players, setPlayers] = useState<TransformedPlayer[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<TransformedPlayer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSoloMode, setIsSoloMode] = useState(false)

  const loadGameData = useCallback(async () => {
    if (!roomCode) return

    try {
      setError(null)
      console.log(`Loading game data for room: ${roomCode}`)

      // Fetch room data
      const { data: roomData, error: roomError } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("room_code", roomCode.toUpperCase())
        .single()

      if (roomError || !roomData) {
        console.error("Room not found:", roomError)
        setError("Room not found")
        setIsLoading(false)
        return
      }

      // Fetch game state
      const { data: gameStateData, error: gameStateError } = await supabase
        .from("game_states")
        .select("*")
        .eq("room_id", roomData.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single()

      // Create game state if it doesn't exist
      let finalGameState = gameStateData
      if (gameStateError || !gameStateData) {
        console.log("Creating initial game state...")
        const { data: newGameState, error: createError } = await supabase
          .from("game_states")
          .insert({
            room_id: roomData.id,
            current_question: 0,
            phase: "lobby",
            time_remaining: 30,
            lives_remaining: 3,
            target_correct_answers: 5,
            current_correct_answers: 0,
            minigame_data: {},
          })
          .select()
          .single()

        if (createError) {
          console.error("Failed to create game state:", createError)
        } else {
          finalGameState = newGameState
        }
      }

      // Fetch players
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomData.id)
        .order("joined_at", { ascending: true })

      if (playersError) {
        console.error("Error fetching players:", playersError)
      }

      // Transform room data
      const transformedRoom: TransformedRoom = {
        code: roomData.room_code,
        hostId: roomData.host_id || "",
        id: roomData.id,
        status: roomData.status,
        current_phase: roomData.current_phase,
        questions: roomData.questions || [],
      }

      // Transform game state
      let phase: TransformedGameState["phase"] = "lobby"
      if (roomData.status === "playing") {
        phase = (roomData.current_phase as TransformedGameState["phase"]) || "quiz"
      } else if (roomData.status === "finished") {
        phase = "finished"
      }

      const transformedGameState: TransformedGameState = {
        phase: phase,
        currentQuestion: finalGameState?.current_question || 0,
        timeRemaining: finalGameState?.time_remaining || 30,
        currentCorrectAnswers: finalGameState?.current_correct_answers || 0,
        targetCorrectAnswers: finalGameState?.target_correct_answers || 5,
      }

      // Transform players data
      const transformedPlayers: TransformedPlayer[] = (playersData || []).map((player) => ({
        id: player.id,
        nickname: player.nickname,
        health: 3, // Default health
        maxHealth: 3,
        score: player.score || 0,
        correctAnswers: player.correct_answers || 0,
        isHost: player.is_host,
        isReady: true, // Default ready state
        hasAnswered: false,
        status: player.is_alive ? "alive" : "dead",
        character_type: player.character_type,
        room_id: player.room_id,
      }))

      // Find or create current player
      let transformedCurrentPlayer: TransformedPlayer | null = null
      if (nickname) {
        transformedCurrentPlayer = transformedPlayers.find((p) => p.nickname === nickname) || null

        // If player not found and we have a nickname, try to create player
        if (!transformedCurrentPlayer && roomData.status === "waiting") {
          console.log(`Creating new player: ${nickname}`)
          const { data: newPlayer, error: playerError } = await supabase
            .from("players")
            .insert({
              room_id: roomData.id,
              nickname: nickname,
              character_type: `robot${Math.floor(Math.random() * 5) + 1}`,
              score: 0,
              correct_answers: 0,
              is_host: transformedPlayers.length === 0, // First player is host
              is_alive: true,
            })
            .select()
            .single()

          if (playerError) {
            console.error("Failed to create player:", playerError)
            setError("Failed to join game")
          } else {
            transformedCurrentPlayer = {
              id: newPlayer.id,
              nickname: newPlayer.nickname,
              health: 3,
              maxHealth: 3,
              score: 0,
              correctAnswers: 0,
              isHost: newPlayer.is_host,
              isReady: true,
              hasAnswered: false,
              status: "alive",
              character_type: newPlayer.character_type,
              room_id: newPlayer.room_id,
            }
            transformedPlayers.push(transformedCurrentPlayer)
          }
        }
      }

      // Set all state
      setRoom(transformedRoom)
      setGameState(transformedGameState)
      setPlayers(transformedPlayers)
      setCurrentPlayer(transformedCurrentPlayer)
      setIsSoloMode(roomCode.startsWith("SOLO_") || !nickname)
      setIsLoading(false)

      console.log("Game data loaded successfully:", {
        room: transformedRoom,
        gameState: transformedGameState,
        players: transformedPlayers.length,
        currentPlayer: transformedCurrentPlayer?.nickname,
      })
    } catch (error) {
      console.error("Error loading game data:", error)
      setError("Failed to load game data")
      setIsLoading(false)
    }
  }, [roomCode, nickname])

  // Setup realtime subscriptions
  useEffect(() => {
    if (!room) return

    console.log(`Setting up realtime subscriptions for room ${room.id}`)

    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          console.log("Room updated:", payload)
          loadGameData()
        },
      )
      .subscribe()

    // Subscribe to game state changes
    const stateChannel = supabase
      .channel(`state-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_states",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          console.log("Game state updated:", payload)
          loadGameData()
        },
      )
      .subscribe()

    // Subscribe to players changes
    // Subscribe to players changes
const playersChannel = supabase
  .channel(`players-${room.id}`)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "players",
      filter: `room_id=eq.${room.id}`,
    },
    (payload) => {
      console.log("Players updated:", payload);
      if (payload.eventType === "DELETE" && payload.old?.id) {
        setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
      } else {
        loadGameData();
      }
    },
  )
  .subscribe();

    // Subscribe to player answers for realtime feedback
    const answersChannel = supabase
      .channel(`answers-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "player_answers",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          console.log("New answer submitted:", payload)
          // This will trigger updates on the host page
        },
      )
      .subscribe()

    return () => {
      console.log("Cleaning up subscriptions")
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(stateChannel)
      supabase.removeChannel(playersChannel)
      supabase.removeChannel(answersChannel)
    }
  }, [room, loadGameData])

  // Initial data load
  useEffect(() => {
    if (roomCode) {
      loadGameData()
    }
  }, [loadGameData, roomCode])

  const refetch = useCallback(() => {
    console.log("Refetching game data...")
    setIsLoading(true)
    loadGameData()
  }, [loadGameData])

  return {
    room,
    gameState,
    players,
    currentPlayer,
    isLoading,
    error,
    isSoloMode,
    refetch,
  }
}