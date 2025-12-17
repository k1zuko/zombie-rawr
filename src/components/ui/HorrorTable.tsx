// src/components/ui/HorrorTable.tsx
"use client"

import { cn } from "@/lib/utils"
import { TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react"

interface HorrorTableProps extends TableHTMLAttributes<HTMLTableElement> {
  className?: string
}

interface HorrorTableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  className?: string
}

interface HorrorTableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  className?: string
}

const HorrorTable = ({ className, ...props }: HorrorTableProps) => (
  <table
    className={cn(
      "w-full border-collapse bg-black/90 border-2 border-red-900/50",
      "shadow-[0_0_20px_rgba(255,0,0,0.3)]",
      className
    )}
    {...props}
  />
)

const HorrorTableHeader = ({ className, ...props }: HorrorTableHeaderProps) => (
  <th
    className={cn(
      "border-b-2 border-red-900/50 px-4 py-3 text-left text-red-200  text-lg uppercase tracking-wide",
      "bg-gradient-to-b from-black to-red-950/20",
      className
    )}
    {...props}
  />
)

const HorrorTableCell = ({ className, ...props }: HorrorTableCellProps) => (
  <td
    className={cn(
      "border-b border-red-900/30 px-4 py-3 text-red-200  text-base",
      "hover:bg-red-900/10 transition-colors duration-200",
      className
    )}
    {...props}
  />
)

const HorrorTableRow = ({ className, ...props }: TableHTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      "border-b border-red-900/30",
      "hover:shadow-[0_0_10px_rgba(255,0,0,0.2)] transition-all duration-200",
      className
    )}
    {...props}
  />
)

const HorrorTableHead = ({ className, ...props }: TableHTMLAttributes<HTMLTableSectionElement>) => (
  <thead
    className={cn("bg-black/95", className)}
    {...props}
  />
)

const HorrorTableBody = ({ className, ...props }: TableHTMLAttributes<HTMLTableSectionElement>) => (
  <tbody
    className={cn(className)}
    {...props}
  />
)

export { HorrorTable, HorrorTableHeader, HorrorTableCell, HorrorTableRow, HorrorTableHead, HorrorTableBody }