import React from "react"
import { cn } from "@/lib/utils"

export function Card({ className, ...props }) {
  return <div className={cn("rounded-2xl bg-white border shadow", className)} {...props} />
}
export function CardHeader({ className, ...props }) {
  return <div className={cn("p-4 border-b bg-gray-50/60 rounded-t-2xl", className)} {...props} />
}
export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />
}
export function CardContent({ className, ...props }) {
  return <div className={cn("p-4", className)} {...props} />
}