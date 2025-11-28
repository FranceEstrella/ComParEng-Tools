import { ImageResponse } from "next/og"

export const runtime = "edge"

const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          width: "100%",
          height: "100%",
          padding: "80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0ea5e9 100%)",
          color: "white",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 32,
            textTransform: "uppercase",
            letterSpacing: 6,
            opacity: 0.85,
          }}
        >
          FEU TECH
        </div>
        <div
          style={{
            fontSize: 90,
            fontWeight: 700,
            lineHeight: 1.05,
            marginTop: 20,
          }}
        >
          ComParEng Tools
        </div>
        <p
          style={{
            fontSize: 32,
            marginTop: 24,
            maxWidth: 760,
            lineHeight: 1.3,
            opacity: 0.9,
          }}
        >
          Course Tracker · Schedule Maker · Academic Planner
        </p>
        <div
          style={{
            marginTop: 60,
            fontSize: 28,
            display: "flex",
            gap: 32,
            opacity: 0.9,
          }}
        >
          <span>✅ Track prerequisites</span>
          <span>🗓️ Build conflict-free schedules</span>
          <span>🎯 Plan your graduation path</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
