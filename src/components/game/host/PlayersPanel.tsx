"use client";

import { RadioTower } from "lucide-react";

interface Player {
  id: string;
  nickname: string;
  character_type: string;
  score: number;
  is_alive: boolean;
  joined_at: string;
}

interface GameRoom {
  id: string;
  room_code: string;
  title: string;
  status: string;
  max_players: number;
  current_phase: string;
}

interface PlayerState {
  id: string;
  health: number;
  maxHealth: number;
  speed: number;
  isBeingAttacked: boolean;
  position: number;
  lastAttackTime: number;
  attackIntensity: number;
  countdown?: number;
}

interface ZombieState {
  isAttacking: boolean;
  targetPlayerId: string | null;
  attackProgress: number;
  basePosition: number;
  currentPosition: number;
}

interface PlayersPanelProps {
  players: Player[];
  gameRoom: GameRoom | null;
  roomCode: string;
  playerStates: { [playerId: string]: PlayerState };
  zombieState: ZombieState;
  recentAttacks: Set<string>;
  getCharacterByType: (type: string) => any;
  getWorkingImagePath: (character: any) => string;
  isConnected: boolean;
}

export default function PlayersPanel({
  players,
  gameRoom,
  roomCode,
  playerStates,
  zombieState,
  recentAttacks,
  getCharacterByType,
  getWorkingImagePath,
  isConnected,
}: PlayersPanelProps) {
  return (
    <div className="absolute top-4 left-4 z-50 bg-black/90 text-white p-4 rounded-md font-mono border border-red-800/50 shadow-md">
      <div className="flex items-center gap-2 mb-2">
        <div title="Status Koneksi">
          <RadioTower
            className={`w-5 h-5 ${isConnected ? "text-green-500" : "text-red-500"}`}
            aria-label="Status Koneksi"
          />
        </div>
        <span className="text-red-500 font-bold">PEMAIN</span>
      </div>
      <div className="grid gap-2">
        <div>
          <span className="text-gray-400">Ruangan:</span> <span>{roomCode}</span>
        </div>
        {players.length === 0 ? (
          <div className="text-gray-400">Tidak ada pemain di ruangan ini</div>
        ) : (
          players
            .filter((player) => {
              const playerState = playerStates[player.id] || { health: 3 };
              return playerState.health > 0;
            })
            .map((player) => {
              const character = getCharacterByType(player.character_type) || {
                src: "/character/player/default-character.gif",
                alt: "Karakter Default",
              };
              const playerState = playerStates[player.id] || {
                health: 3,
                maxHealth: 3,
                speed: 20,
                isBeingAttacked: false,
                countdown: undefined,
              };
              const { health, maxHealth, speed, isBeingAttacked, countdown } = playerState;
              const isRecentlyAttacked = recentAttacks.has(player.id);

              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 p-2 rounded-md ${
                    isBeingAttacked || isRecentlyAttacked ? "bg-red-900/50" : ""
                  } ${!player.is_alive ? "opacity-50" : ""}`}
                >
                  <img
                    src={getWorkingImagePath(character)}
                    alt={character.alt}
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      e.currentTarget.src = "/character/player/default-character.gif";
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{player.nickname}</span>
                      {!player.is_alive && (
                        <span className="text-red-500 text-xs">(Tersingkir)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      Kesehatan: {health}/{maxHealth} | Kecepatan: {speed}
                      {countdown !== undefined && countdown > 0 && (
                        <span className="text-yellow-300"> | Timer: {countdown}s</span>
                      )}
                      {isBeingAttacked && (
                        <span className="text-red-500"> (Diserang)</span>
                      )}
                      {isRecentlyAttacked && !isBeingAttacked && (
                        <span className="text-orange-500"> (Baru Diserang)</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}