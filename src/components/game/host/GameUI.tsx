
"use client";

import { Clock, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface GameUIProps {
  roomCode: string;
}

export default function GameUI({ roomCode }: GameUIProps) {
  // State untuk informasi ruangan dan waktu tersisa
  const [roomInfo, setRoomInfo] = useState<{ game_start_time: string; duration: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Mengambil informasi ruangan dari Supabase
  useEffect(() => {
    const fetchRoomInfo = async () => {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("game_start_time, duration")
        .eq("room_code", roomCode.toUpperCase())
        .single();

      if (error) {
        console.error("❌ Gagal fetch room info:", error.message);
      } else {
        setRoomInfo(data);
      }
    };

    fetchRoomInfo();
  }, [roomCode]);

  // Menghitung dan memperbarui waktu tersisa
  useEffect(() => {
    if (!roomInfo?.game_start_time || !roomInfo.duration) return;

    const start = new Date(roomInfo.game_start_time).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - start) / 1000);
    const remaining = Math.max(0, roomInfo.duration - elapsed);

    setTimeLeft(remaining);

    const interval = setInterval(() => {
      const now = Date.now();
      const newElapsed = Math.floor((now - start) / 1000);
      const newRemaining = Math.max(0, roomInfo.duration - newElapsed);
      setTimeLeft(newRemaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [roomInfo]);

  // Fungsi untuk memformat waktu ke MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <>
      {/* Time Left Display */}
<div className="bg-black/80 border-2 border-red-800 rounded-lg p-2 pl-8 pr-8 shadow-[0_0_20px_rgba(255,0,0,0.5)] flex items-center space-x-3">
  
  <span
    className={`text-4xl font-bold text-red-600 blood-effect ${timeLeft <= 30 ? "animate-pulse" : ""}`}
    style={{
      fontFamily: "'Creepster', cursive",
      textShadow: "0 0 15px rgba(255, 0, 0, 0.8)",
    }}
  >
    {formatTime(timeLeft)}
  </span>
  {timeLeft <= 15 && (
    <AlertTriangle className="w-7 h-7 text-red-600 animate-bounce" />
  )}
</div>


      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes blood-drip {
          0% { transform: translateY(-5px); opacity: 0; }
          50% { transform: translateY(5px); opacity: 0.7; }
          100% { transform: translateY(10px); opacity: 0; }
        }
          .blood-effect::before {
            content: '';
            position: absolute;
            top: -10px;
            left: 50%;
            width: 10px;
            height: 20px;
            background: radial-gradient(circle, rgba(255, 0, 0, 0.7) 0%, rgba(255, 0, 0, 0) 70%);
            animation: blood-drip 1.5s infinite;
          }
        .animate-pulse { animation: pulse 1s infinite; }
        .animate-blood-drip {
          animation: blood-drip 1.5s infinite;
          background: radial-gradient(circle, rgba(255, 0, 0, 0.7) 0%, rgba(255, 0, 0, 0) 70%);
        }
      `}</style>
    </>
  );
}
