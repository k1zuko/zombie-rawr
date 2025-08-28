
"use client";

import { motion } from "framer-motion";

interface AttackIndicatorProps {
  isAttacking: boolean;
  targetPlayerNickname: string | null;
}

export default function AttackIndicator({ isAttacking, targetPlayerNickname }: AttackIndicatorProps) {
  if (!isAttacking || !targetPlayerNickname) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex items-center bg-red-900/90 text-white font-mono text-sm px-3 py-2 rounded-lg shadow-lg border border-red-500/50 animate-pulse"
    >
      <span className="flex-1 truncate">Menyerang {targetPlayerNickname}!</span>
    </motion.div>
  );
}