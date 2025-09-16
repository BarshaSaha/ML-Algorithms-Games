import React from "react"
import { cn } from "@/lib/utils"

export const Button = React.forwardRef(function Button(
  { className, variant, ...props },
  ref
){
  const base = "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium border shadow-sm transition"
  const styles = variant==="secondary"
    ? "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
    : "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
  return <button ref={ref} className={cn(base, styles, className)} {...props} />
})