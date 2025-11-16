import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import InstallBanner from "@/components/install-banner"
import ServiceWorkerRegister from "@/components/service-worker-register"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ComParEng Course Tracker",
  description: "Track your Computer Engineering courses, prerequisites, and progress",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/apple-icon.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f172a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" }
  ],
  manifest: "/manifest.webmanifest",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <link rel="icon" href="/favicon.ico" />
        <link rel="alternate icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" sizes="192x192" href="/apple-icon.png" type="image/png" />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <div className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 p-2 text-center text-xs md:text-sm">
            <strong>Disclaimer:</strong> This is a personal project and is NOT officially affiliated with FEU Tech or the FEU Tech CpE Department.
          </div>
          <InstallBanner />
          <ServiceWorkerRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
