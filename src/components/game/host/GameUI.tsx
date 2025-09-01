"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface GameUIProps {
  roomCode: string;
}

export default function GameUI({ roomCode }: GameUIProps) {
  const [roomInfo, setRoomInfo] = useState<{ game_start_time: string; duration: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

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

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <>
      {/* Time Left Display */}
      <div className="flex items-center justify-center">
        <span
          className="text-8xl font-bold text-red-600"
          style={{
            fontFamily: "'Digital-7', monospace", // Font digital untuk kejelasan
            textShadow: "0 0 10px rgba(247, 0, 0, 0.8)",
          }}
        >
          {formatTime(timeLeft)}
        </span>
      </div>

      <style jsx>{`
        @font-face {
          font-family: 'Digital-7';
          src: url('https://fonts.cdnfonts.com/css/digital-7');
        }
      `}</style>
    </>
  );
}