"use client";

import { useState, useEffect } from "react";

export default function GameUI({
  roomCode,               // masih boleh dipakai kalau butuh nanti
  startedAt,              // string | null
  totalTimeMinutes = 5,   // fallback
}: {
  roomCode: string;
  startedAt: string | null;
  totalTimeMinutes?: number;
}) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setTimeLeft(0);
      return;
    }

    const startTime = new Date(startedAt).getTime();
    const durationSeconds = totalTimeMinutes * 60;

    const update = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, durationSeconds - elapsed);
      setTimeLeft(remaining);
    };

    update(); // immediate update
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [startedAt, totalTimeMinutes]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="flex items-center justify-center">
      <span
        className="text-8xl text-red-600 select-none"
        style={{
          textShadow: "0 0 20px rgba(220, 0, 0, 0.9), 0 0 40px rgba(255, 0, 0, 0.6)",
          letterSpacing: "4px",
        }}
      >
        {formatTime(timeLeft)}
      </span>
    </div>
  );
}