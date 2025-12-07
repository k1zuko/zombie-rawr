"use client";

import { useState, useEffect } from "react";
import { mysupa } from "@/lib/supabase"; // GANTI DARI supabase → mysupa

export default function GameUI({ roomCode }: { roomCode: string }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const startTimer = async () => {
      const { data: session, error } = await mysupa
        .from("sessions")
        .select("started_at, total_time_minutes")
        .eq("game_pin", roomCode.toUpperCase())
        .single();

      if (error || !session?.started_at) {
        setTimeLeft(0);
        return;
      }

      const startTime = new Date(session.started_at).getTime();
      const durationSeconds = (session.total_time_minutes || 5) * 60;

      const update = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, durationSeconds - elapsed);
        setTimeLeft(remaining);
      };

      update();
      interval = setInterval(update, 1000);
    };

    startTimer();

    // Realtime update jika started_at berubah (misal host start game)
    const channel = mysupa
      .channel(`timer-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `game_pin=eq.${roomCode.toUpperCase()}`,
        },
        (payload) => {
          if (payload.new.started_at && !payload.old.started_at) {
            // Game baru dimulai → restart timer
            window.location.reload(); // paling simpel & akurat
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      mysupa.removeChannel(channel);
    };
  }, [roomCode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <>
      <div className="flex items-center justify-center">
        <span
          className="text-8xl font-bold text-red-600 select-none"
          style={{
            fontFamily: "'Digital-7', monospace",
            textShadow: "0 0 20px rgba(220, 0, 0, 0.9), 0 0 40px rgba(255, 0, 0, 0.6)",
            letterSpacing: "4px",
          }}
        >
          {formatTime(timeLeft)}
        </span>
      </div>

      <style jsx>{`
        @font-face {
          font-family: "Digital-7";
          src: url("https://fonts.cdnfonts.com/css/digital-7") format("truetype");
        }
      `}</style>
    </>
  );
}