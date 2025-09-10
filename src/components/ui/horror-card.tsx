"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface HorrorCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "dark" | "blood" | "shadow" | "curse"
  glowing?: boolean
  animated?: boolean
}

const HorrorCard = forwardRef<HTMLDivElement, HorrorCardProps>(
  ({ className, variant = "dark", glowing = false, animated = false, children, ...props }, ref) => {
    const variants = {
      dark: "bg-gray-900/90 border-gray-700/50",
      blood: "bg-gray-900/90 border-red-900/50",
      shadow: "bg-black/80 border-gray-800/50",
      curse: "bg-gray-900/90 border-purple-900/50",
    }

    return (
      <Card
        ref={ref}
        className={cn(
          "backdrop-blur-sm transition-all duration-300 relative overflow-hidden group",
          variants[variant],
          glowing && "shadow-[0_0_20px_rgba(239,68,68,0.3)]",
          animated && "hover:scale-102 hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]",
          className,
        )}
        {...props}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative z-10">{children}</div>
      </Card>
    )
  },
)

HorrorCard.displayName = "HorrorCard"

export { HorrorCard }
