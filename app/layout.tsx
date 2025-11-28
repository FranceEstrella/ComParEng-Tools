import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import InstallBanner from "@/components/install-banner"
import ServiceWorkerRegister from "@/components/service-worker-register"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL("https://compareng-tools.vercel.app"),
  title: {
    default: "FEU Tech ComParEng Tools",
    template: "%s | ComParEng Tools",
  },
  description: "Course Tracker, Schedule Maker, and Academic Planner for FEU Tech students.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/android-icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/apple-icon-152x152.png", sizes: "152x152" },
      { url: "/apple-icon-120x120.png", sizes: "120x120" },
    ],
    other: [
      { rel: "mask-icon", url: "/icon.svg", color: "#0f172a" },
    ],
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f172a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  manifest: "/manifest.webmanifest",
  generator: "v0.dev",
  openGraph: {
    type: "website",
    url: "https://compareng-tools.vercel.app",
    title: "FEU Tech ComParEng Tools",
    description: "Plan schedules, track CpE courses, and map your path to graduation.",
    siteName: "ComParEng Tools",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "ComParEng Tools preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@feutech",
    title: "FEU Tech ComParEng Tools",
    description: "Course Tracker, Schedule Maker, and Academic Planner in one place.",
    images: ["/opengraph-image"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
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
