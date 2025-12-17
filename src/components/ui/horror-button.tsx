"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface HorrorButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "blood" | "shadow" | "curse" | "ghost"
  size?: "sm" | "md" | "lg"
  glowing?: boolean
}

const HorrorButton = forwardRef<HTMLButtonElement, HorrorButtonProps>(
  ({ className, variant = "blood", size = "md", glowing = false, children, ...props }, ref) => {
    const variants = {
      blood:
        "bg-red-600 hover:bg-red-700 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]",
      shadow:
        "bg-gray-800 hover:bg-gray-700 border-gray-600 text-white shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(0,0,0,0.7)]",
      curse:
        "bg-purple-600 hover:bg-purple-700 border-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)]",
      ghost:
        "bg-gray-700/50 hover:bg-gray-600/50 border-gray-500/50 text-gray-200 backdrop-blur-sm shadow-[0_0_20px_rgba(107,114,128,0.2)] hover:shadow-[0_0_30px_rgba(107,114,128,0.4)]",
    }

    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    }

    return (
      <Button
        ref={ref}
        className={cn(
          " border-2 transition-all duration-300 relative overflow-hidden group",
          variants[variant],
          sizes[size],
          glowing && "animate-pulse",
          className,
        )}
        {...props}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        <span className="relative z-10">{children}</span>
      </Button>
    )
  },
)

HorrorButton.displayName = "HorrorButton"

export { HorrorButton }
