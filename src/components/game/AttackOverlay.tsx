// components/game/AttackOverlay.tsx
import React from "react";
import { useTranslation } from "react-i18next";

interface AttackOverlayProps {
  isVisible: boolean;
}

export default function AttackOverlay({ isVisible }: AttackOverlayProps) {
  const {t} = useTranslation()
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none bg-gradient-to-b from-red-900/50 to-black/70 flex items-center justify-center">
      {/* Vignette Effect */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/40" />

      {/* Blood Particles */}
      <div className="absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-red-600/60 rounded-full animate-blood-float"
            style={{
              width: `${Math.random() * 6 + 3}px`,
              height: `${Math.random() * 6 + 3}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDuration: `1.5s`,
              animationDelay: `${Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Main Text */}
      <div className="relative flex flex-col items-center animate-fade-in">
        <div className="text-2xl sm:text-3xl md:text-4xl font-horror text-red-500 text-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-tremble">
          {t("youAreAttacked")}
        </div>
      </div>

      <style jsx global>{`
        .font-horror {
          font-family: 'Creepster', cursive, sans-serif;
        }

        @font-face {
          font-family: 'Creepster';
          src: url('https://fonts.googleapis.com/css2?family=Creepster&display=swap');
        }

        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }

        @keyframes tremble {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-1px); }
          50% { transform: translateX(1px); }
          75% { transform: translateX(-0.5px); }
        }

        @keyframes blood-float {
          0% { transform: translateY(0); opacity: 0.5; }
          50% { opacity: 0.3; }
          100% { transform: translateY(-15px); opacity: 0; }
        }

        .animate-fade-in {
          animation: fade-in 2s ease-out forwards;
        }

        .animate-tremble {
          animation: tremble 0.2s ease-in-out infinite;
        }

        .animate-blood-float {
          animation: blood-float 1.5s ease-out infinite;
        }

        .text-shadow-[0_2px_4px_rgba(0,0,0,0.8)] {
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
        }
      `}</style>
    </div>
  );
}