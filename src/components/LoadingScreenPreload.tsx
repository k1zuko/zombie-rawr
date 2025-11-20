"use client";

import { usePreload } from '@/contexts/PreloadContext';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function LoadingScreenPreload() {
  const { isPreloading } = usePreload();
  const [dots, setDots] = useState("");
  const [show, setShow] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isPreloading) {
      const timer = setTimeout(() => setShow(false), 1000); // Wait for fade out animation
      return () => clearTimeout(timer);
    }
  }, [isPreloading]);


  if (!show) {
    return null;
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden z-[9999]"
      initial={{ opacity: 1 }}
      animate={{ opacity: isPreloading ? 1 : 0 }}
      transition={{ duration: 1.0 }}
      style={{ pointerEvents: isPreloading ? 'auto' : 'none' }}
    >
      {/* Red flicker */}
      <motion.div
        className="absolute inset-0 bg-red-900 pointer-events-none"
        animate={{ opacity: [0, 0.45, 0] }}
        transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 2 }}
      />
      {/* Scanline */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, #000 3px, #000 6px)" }}
      />

      <div className="relative text-center">
        <motion.h1
          className="text-4xl sm:text-6xl font-bold text-red-600 tracking-widest font-mono"
          style={{ textShadow: "0 0 20px #ff0000, 4px 4px 0 #000" }}
          animate={{ x: [-2, 2, -2, 2, 0] }}
          transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 1 }}
        >
          PREPARING ASSETS{dots}
        </motion.h1>
        <p className="text-sm text-red-500 mt-4 opacity-80 animate-pulse font-mono">
          Please wait a moment...
        </p>
      </div>
    </motion.div>
  );
}
