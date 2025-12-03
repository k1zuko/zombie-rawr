import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabaseUrlGame = process.env.NEXT_PUBLIC_SUPABASE_URL_MINE!
const supabaseAnonKeyGame = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MINE!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const mysupa = createClient(supabaseUrlGame, supabaseAnonKeyGame)

// Type untuk EmbeddedPlayer (dari JSONB game_rooms.players)
export type EmbeddedPlayer = {
  player_id: string;
  nickname: string;
  character_type: string;
  score: number;
  correct_answers: number;
  is_host: boolean;
  position_x: number;
  position_y: number;
  is_alive: boolean;
  joined_at: string;
  power_ups: number;
  health: {
    current: number;
    max: number;
    is_being_attacked: boolean;
    last_attack_time: string;
    speed: number;
    last_answer_time: string;
    countdown: number;
  };
  answers: any[];
  attacks: any[];
  room_id?: string;  // Tambahan untuk fallback
};

export type GameRoom = {
  id: string;
  room_code: string;
  host_id: string | null;
  title: string;
  status: 'waiting' | 'playing' | 'finished';
  max_players: number;
  duration: number;
  quiz_id: string | null;
  chaser_type: 'zombie' | 'monster1' | 'monster2' | 'monster3' | 'darknight';
  difficulty_level: 'easy' | 'medium' | 'hard';
  created_at: string;
  updated_at: string;
  game_start_time: string | null;
  countdown_start: string | null;
  question_count: number;
  embedded_questions: any[];
  players: EmbeddedPlayer[];  // Array EmbeddedPlayer
};

export type Quiz = {
  id: string;
  theme: string;
  description: string | null;
  duration: number;
  difficulty_level: 'easy' | 'medium' | 'hard';
  questions: Array<{
    id: string | number;
    question: string;
    options: string[];
    correct_answer: string;
  }>;
  created_at: string;
};

export type GameCompletion = {
  id: string;
  player_id: string;
  room_id: string;
  final_health: number;
  correct_answers: number;
  total_questions_answered: number;
  is_eliminated: boolean;
  completion_type: 'partial' | 'full' | 'eliminated';
  survival_duration: number;
  completed_at: string;
};