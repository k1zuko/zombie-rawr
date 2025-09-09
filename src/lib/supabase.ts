import { createClient } from "@supabase/supabase-js"

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // const supabaseUrlUtama = process.env.NEXT_PUBLIC_SUPABASE_URL_UTAMA!
  // const supabaseAnonKeyUtama = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_UTAMA!

  export const supabase = createClient(supabaseUrl, supabaseAnonKey)
  // export const supabaseUtama = createClient(supabaseUrlUtama, supabaseAnonKeyUtama)

export type GameRoom = {
  question_count: number; // Diperbaiki dari 'any' menjadi 'number' untuk konsistensi
  id: string;
  room_code: string;
  host_player_id: string | null; // Combines host_id and host_player_id
  question_set_id: string | null; // From second definition, for question set reference
  title: string | null; // From first definition, optional
  status: "waiting" | "playing" | "finished";
  current_phase: "lobby" | "quiz" | "minigame" | "finished";
  max_players: number; // Used in HostPage.tsx for player count display
  duration: number; // Used in HostPage.tsx for duration display
  questions: any[]; // Used in HostPage.tsx, can be refined later
  created_at: string;
  updated_at: string;
  chaser_type: 'zombie' | 'monster1' | 'monster2' |"monster3"| 'darknight'; // Ditambahkan untuk mendukung pemilihan karakter pengejar
};

export type Player = {
  id: string
  room_id: string
  nickname: string
  character_type: string
  health: number // Used in LobbyPhase.tsx via SoulStatus
  max_health: number // Used in LobbyPhase.tsx via SoulStatus
  score: number // Used in LobbyPhase.tsx via SoulStatus
  correct_answers: number
  wrong_answers: number // From first definition
  is_host: boolean // Used in LobbyPhase.tsx and HostPage.tsx
  is_alive: boolean
  power_ups: number // From first definition
  position_x: number // From first definition
  position_y: number // From first definition
  created_at: string
  updated_at: string
  joined_at: string // Used in HostPage.tsx for player join time
}

export type GameState = {
  id: string
  room_id: string
  current_question_index: number // From second definition
  phase: "lobby" | "quiz" | "minigame" | "finished" // From first definition
  time_remaining: number
  lives_remaining: number // From first definition
  target_correct_answers: number // From first definition
  current_correct_answers: number // From first definition
  minigame_data: any // From first definition
  status: "waiting" | "playing" | "finished" // From second definition
  created_at: string
  updated_at: string
}

export type SafeZone = {
  x: number
  y: number
  width: number
  height: number
  occupied: number
  required: number
}

export type PlayerHealthState = {
  id: string
  player_id: string
  room_id: string
  health: number
  is_alive: boolean // From second definition
  is_being_attacked: boolean // From first definition
  last_attack_time: string // From first definition
  created_at: string
  updated_at: string
}

export type PlayerAttack = {
  id: string
  room_id: string
  attacker_player_id: string // From second definition
  target_player_id: string
  damage: number
  attack_type: string
  attack_data: any // From second definition
  created_at: string
}

export type PlayerAnswer = {
  id: string
  player_id: string
  room_id: string
  question_index: number
  answer: string
  is_correct: boolean
  answered_at: string
}