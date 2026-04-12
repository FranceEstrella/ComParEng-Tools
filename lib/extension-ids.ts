const EXTENSION_ID_RE = /^[a-p]{32}$/

export const COMPARENG_PUBLIC_EXTENSION_ID = "fdfappahfelppgjnpbobconjogebpiml"
export const COMPARENG_DEV_EXTENSION_ID = "gehelkdgojjkhknhelkfmenoligihjml"

function parseConfiguredIds(raw: string | undefined): string[] {
  if (!raw) return []

  return raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => EXTENSION_ID_RE.test(value))
}

export const COMPARENG_EXTENSION_IDS = (() => {
  const configured = parseConfiguredIds(process.env.NEXT_PUBLIC_COMPARENG_EXTENSION_ID)
  const base = configured.length ? configured : [COMPARENG_PUBLIC_EXTENSION_ID, COMPARENG_DEV_EXTENSION_ID]
  return Array.from(new Set([...base, COMPARENG_PUBLIC_EXTENSION_ID, COMPARENG_DEV_EXTENSION_ID]))
})()
