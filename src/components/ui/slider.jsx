import React from "react"
import { cn } from "@/lib/utils"

export function Slider({ value=[0], onValueChange, min=0, max=100, step=1, className }){
  const v = Array.isArray(value) ? value[0] : value
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={v}
      onChange={(e)=> onValueChange && onValueChange([Number(e.target.value)])}
      className={cn("w-56", className)}
    />
  )
}