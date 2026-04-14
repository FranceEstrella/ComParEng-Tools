"use client"

import { useEffect, useMemo, useState } from "react"

type PreviewMode = "reward" | "profile"
type ProfileThemeId = "violet" | "indigo" | "midnight"

type OnboardingRewardProfilePreviewProps = {
  mode?: PreviewMode
}

function useOscillatingValue(min: number, max: number, durationMs: number, enabled: boolean) {
  const [value, setValue] = useState(min)

  useEffect(() => {
    if (!enabled) {
      setValue(min)
      return
    }

    let frameId = 0
    const start = performance.now()

    const tick = (now: number) => {
      const phase = ((now - start) % durationMs) / durationMs
      // Smooth 0 -> 1 -> 0 loop for seamless bar motion.
      const wave = (1 - Math.cos(phase * Math.PI * 2)) / 2
      setValue(min + (max - min) * wave)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [min, max, durationMs, enabled])

  return value
}

const rewardSteps = [
  {
    title: "Term 2 Complete",
    xpGain: 600,
    tier: "Pathfinder",
    level: 2,
    currentXp: 1200,
    nextXp: 2500,
    badge: "T2",
  },
  {
    title: "Term 3 Complete",
    xpGain: 600,
    tier: "Vanguard",
    level: 3,
    currentXp: 1800,
    nextXp: 3200,
    badge: "T3",
  },
]

const profileBadges = [
  { name: "Term 1 Complete", xp: "+600 XP" },
  { name: "Term 2 Complete", xp: "+600 XP" },
  { name: "Term 3 Complete", xp: "+600 XP" },
  { name: "Term 1 Complete", xp: "+900 XP" },
  { name: "Year 1 Complete", xp: "+1800 XP" },
]

const profileThemes: Record<
  ProfileThemeId,
  {
    label: string
    root: string
    panel: string
    card: string
    chip: string
    bar: string
  }
> = {
  violet: {
    label: "Violet",
    root: "border-violet-200/35 text-white shadow-[0_12px_36px_rgba(33,28,77,0.5)]",
    panel: "border-violet-200/35",
    card: "border-violet-200/30",
    chip: "text-violet-100",
    bar: "bg-gradient-to-r from-violet-300 via-purple-400 to-violet-500",
  },
  indigo: {
    label: "Indigo",
    root: "border-indigo-200/35 text-white shadow-[0_12px_36px_rgba(20,35,80,0.5)]",
    panel: "border-indigo-200/35",
    card: "border-indigo-200/30",
    chip: "text-indigo-100",
    bar: "bg-gradient-to-r from-indigo-300 via-blue-400 to-indigo-500",
  },
  midnight: {
    label: "Midnight",
    root: "border-slate-200/25 text-white shadow-[0_12px_36px_rgba(12,16,36,0.52)]",
    panel: "border-slate-200/25",
    card: "border-slate-200/25",
    chip: "text-slate-100",
    bar: "bg-gradient-to-r from-slate-300 via-violet-400 to-indigo-500",
  },
}

const profileThemeStyles: Record<
  ProfileThemeId,
  {
    rootGradient: string
    panelGradient: string
    cardGradient: string
    chipGradient: string
    swatchGradient: string
  }
> = {
  violet: {
    rootGradient: "linear-gradient(135deg, #21134f 0%, #3b287f 45%, #6448b8 100%)",
    panelGradient: "linear-gradient(145deg, #221952 0%, #2b2061 55%, #342974 100%)",
    cardGradient: "linear-gradient(145deg, #1a143f 0%, #21194e 55%, #2a215f 100%)",
    chipGradient: "linear-gradient(145deg, #3a2f7a 0%, #46398f 100%)",
    swatchGradient: "linear-gradient(135deg, #38338d 0%, #5a4fc2 45%, #9a84ea 100%)",
  },
  indigo: {
    rootGradient: "linear-gradient(135deg, #0f1f4a 0%, #1a356d 45%, #2f5aa8 100%)",
    panelGradient: "linear-gradient(145deg, #172c5d 0%, #20397a 55%, #294893 100%)",
    cardGradient: "linear-gradient(145deg, #12234b 0%, #1a2e5f 55%, #223b76 100%)",
    chipGradient: "linear-gradient(145deg, #29477f 0%, #345999 100%)",
    swatchGradient: "linear-gradient(135deg, #1e2a64 0%, #3b4f9f 45%, #6e8ae6 100%)",
  },
  midnight: {
    rootGradient: "linear-gradient(135deg, #0b132d 0%, #162347 45%, #27406a 100%)",
    panelGradient: "linear-gradient(145deg, #131f43 0%, #1a2b55 55%, #23386a 100%)",
    cardGradient: "linear-gradient(145deg, #0f1a36 0%, #152346 55%, #1d2f58 100%)",
    chipGradient: "linear-gradient(145deg, #304766 0%, #3c5b7f 100%)",
    swatchGradient: "linear-gradient(135deg, #151c3d 0%, #2c2f73 45%, #5a4f8f 100%)",
  },
}

export default function OnboardingRewardProfilePreview({ mode = "reward" }: OnboardingRewardProfilePreviewProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [profileTheme, setProfileTheme] = useState<ProfileThemeId>("violet")

  const rewardProgress = useOscillatingValue(32, 44, 3200, mode === "reward")
  const rankProgress = useOscillatingValue(78, 84, 3600, mode === "profile")
  const profileProgress = useOscillatingValue(55, 59, 3000, mode === "profile")

  useEffect(() => {
    if (mode !== "reward") return

    const interval = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % rewardSteps.length)
    }, 2800)

    return () => window.clearInterval(interval)
  }, [mode])

  const activeStep = useMemo(() => rewardSteps[stepIndex], [stepIndex])
  const activeTheme = profileThemes[profileTheme]
  const activeProfileStyle = profileThemeStyles[profileTheme]
  const rankProgressRounded = Math.round(rankProgress)
  const profileProgressRounded = Math.round(profileProgress)

  const rootClassName =
    mode === "reward"
      ? "border-amber-200/20 bg-gradient-to-br from-[#3a240f] via-[#141019] to-[#050507] text-amber-50 shadow-[0_12px_36px_rgba(0,0,0,0.4)]"
      : activeTheme.root

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-3 transition-all duration-500 ${rootClassName}`}
      style={mode === "profile" ? { background: activeProfileStyle.rootGradient } : undefined}
    >
      {mode !== "reward" && (
        <>
          <div className="pointer-events-none absolute -left-12 -top-10 h-44 w-44 rounded-full bg-indigo-500/18 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-36 w-36 rounded-full bg-violet-500/16 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 14%, rgba(129,140,248,0.2), transparent 34%), radial-gradient(circle at 92% 0%, rgba(168,85,247,0.16), transparent 24%)",
            }}
          />
        </>
      )}

      <div className="relative space-y-2.5">
        {mode === "reward" && (
          <div className="rounded-xl border border-amber-200/20 bg-gradient-to-br from-[#3a240f] via-[#141019] to-[#050507] p-2.5">
            <div className="mx-auto mb-2 flex w-fit items-center gap-2 rounded-full border border-[#c89f4a] bg-[#1d1512] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f7db8d] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.2)]">
              <span className="inline-flex h-5 w-5 animate-pulse items-center justify-center rounded-full border border-amber-100/60 bg-gradient-to-br from-[#fbbf24] to-[#f97316] text-[10px] font-bold text-[#2a1205] shadow-[0_0_0_2px_rgba(0,0,0,0.35)]">
                {activeStep.badge}
              </span>
              {activeStep.tier}
            </div>

            <p className="text-center text-[10px] uppercase tracking-[0.26em] text-amber-200/80">Term completed</p>
            <p className="mt-1 text-center text-lg font-bold leading-tight text-amber-50">{activeStep.title}</p>
            <p className="mt-0.5 text-center text-xs text-amber-100/90">XP +{activeStep.xpGain}</p>

            <div className="mt-2.5 rounded-lg border border-amber-200/20 bg-[#1a1318] px-2 py-1.5 text-[10px]">
              <div className="mb-1 flex items-center justify-between text-amber-100/90">
                <span>Level {activeStep.level}</span>
                <span>{activeStep.currentXp} XP</span>
                <span>Next: {activeStep.nextXp} XP</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#35261f]">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 transition-all duration-700 ease-out"
                  style={{ width: `${rewardProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {mode === "profile" && (
          <div
            className={`rounded-xl border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${activeTheme.panel}`}
            style={{ backgroundImage: activeProfileStyle.panelGradient }}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-[#3a3372] text-sm font-bold shadow-[0_0_0_2px_rgba(20,16,44,0.45)]">CT</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">Profile overview</p>
                  <p className="text-xl leading-none font-semibold sm:text-[23px]">Set your profile</p>
                  <p className="mt-0.5 text-[11px] text-white/80">Add your program</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-[#342d67] text-xs">✎</span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-[#342d67] text-xs">✕</span>
              </div>
            </div>

            <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${activeTheme.chip}`} style={{ backgroundImage: activeProfileStyle.chipGradient }}>Year 3</span>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${activeTheme.chip}`} style={{ backgroundImage: activeProfileStyle.chipGradient }}>Rank: Vanguard</span>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${activeTheme.chip}`} style={{ backgroundImage: activeProfileStyle.chipGradient }}>Grad S.Y 2028-2029 Term 1</span>
            </div>

            <div className="mb-2 grid gap-1.5 sm:grid-cols-2 text-[10px]">
              <div className={`rounded-lg border px-2 py-2 shadow-sm ${activeTheme.card}`} style={{ backgroundImage: activeProfileStyle.cardGradient }}>
                <p className="text-sm font-semibold">Progress & rank</p>
                <p className="text-white/70">Current XP and level</p>
                <div className="mt-1 flex justify-center">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-300 via-purple-400 to-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#5f49ad] text-[9px]">★</span>
                    Vanguard
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm font-semibold">
                  <span>Level 3</span>
                  <span>{rankProgressRounded}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#3b356f]">
                  <div className={`h-full ${activeTheme.bar} transition-all duration-500 ease-linear`} style={{ width: `${rankProgress}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-white/80">
                  <span>4,500 XP</span>
                  <span>500 XP to next</span>
                </div>
              </div>
              <div className={`rounded-lg border px-2 py-2 shadow-sm ${activeTheme.card}`} style={{ backgroundImage: activeProfileStyle.cardGradient }}>
                <p className="text-sm font-semibold">Academic progress</p>
                <p className="text-white/70">Syncs from Course Tracker</p>
                <div className="mt-1 flex items-center justify-between text-sm font-semibold">
                  <span>Overall completion</span>
                  <span>{profileProgressRounded}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#3b356f]">
                  <div className={`h-full ${activeTheme.bar} transition-all duration-500 ease-linear`} style={{ width: `${profileProgress}%` }} />
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1 text-white/85">
                  <div className="rounded bg-[#332d62] px-1.5 py-1"><span className="font-semibold">48</span><span className="ml-1 text-[9px]">Passed</span></div>
                  <div className="rounded bg-[#332d62] px-1.5 py-1"><span className="font-semibold">6</span><span className="ml-1 text-[9px]">Active</span></div>
                  <div className="rounded bg-[#332d62] px-1.5 py-1"><span className="font-semibold">33</span><span className="ml-1 text-[9px]">Pending</span></div>
                </div>
                <p className="mt-1 text-[10px] text-white/90">Estimated graduation: S.Y 2028-2029 Term 1</p>
              </div>
            </div>

            <div className="rounded-lg border border-white/15 bg-[#1a1734] p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-lg font-semibold leading-none">Badges earned</p>
                <p className="text-[10px] text-white/80">5 total</p>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {profileBadges.map((badge, index) => (
                  <div
                    key={badge.name + index}
                    className="flex items-center justify-between rounded-md border border-white/15 bg-[#2c2754] px-2 py-1.5 text-[10px] transition-transform duration-200 hover:-translate-y-0.5"
                    style={{ animation: `pulse 2.8s ${index * 0.12}s ease-in-out infinite` }}
                  >
                    <div>
                      <p className="font-semibold text-white">{badge.name}</p>
                      <p className="text-[9px] text-white/70">Year 1</p>
                    </div>
                    <span className="rounded-full bg-[#4b4386] px-1.5 py-0.5 font-semibold text-white">{badge.xp}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2 rounded-lg border border-white/15 bg-[#1a1734] px-2 py-1.5 text-[10px]">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="font-semibold text-white/90">Profile background</p>
                <p className="text-white/70">Live preview</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(profileThemes) as ProfileThemeId[]).map((themeId) => (
                  <button
                    key={themeId}
                    type="button"
                    onClick={() => setProfileTheme(themeId)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition ${
                      profileTheme === themeId
                        ? "border-violet-100/90 bg-[#4d448f] text-white"
                        : "border-white/35 bg-[#2b2454] text-white/85 hover:bg-[#352c64]"
                    }`}
                    aria-label={`Use ${profileThemes[themeId].label} profile background`}
                    title={profileThemes[themeId].label}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/50"
                      style={{
                        background: profileThemeStyles[themeId].swatchGradient,
                      }}
                    />
                    <span className="text-[10px] font-semibold">{profileThemes[themeId].label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
