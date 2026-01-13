"use client"

import Navbar from "./navbar"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const TOOL_PATHS = new Set(["/course-tracker", "/schedule-maker", "/academic-planner"])

export default function NavbarWrapper() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  if (TOOL_PATHS.has(pathname ?? "")) return null
  if ((pathname ?? "") === "/") return null

  return <Navbar />
}
