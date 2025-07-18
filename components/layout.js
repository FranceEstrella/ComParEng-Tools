"use client"

import { useTheme } from "next-themes"
import Navbar from "./navbar"

export default function Layout({ children }) {
  const { theme } = useTheme()

  return (
    <div className={`min-h-screen flex flex-col ${theme === "dark" ? "dark bg-gray-900" : "bg-gray-50"}`}>
      <Navbar />
      <main className="flex-grow">{children}</main>
    </div>
  )
}
