export type RedisConfig = { url: string; token: string }

function normalizeRedisRestUrl(value: string) {
  return value.replace(/\/$/, "")
}

function parseRedisConnectionUrl(value: string): RedisConfig | null {
  try {
    const parsed = new URL(value)
    const token = parsed.password?.trim()
    if (!parsed.hostname || !token) return null

    return {
      url: `https://${parsed.hostname}`,
      token,
    }
  } catch {
    return null
  }
}

export function getRedisConfig(): RedisConfig | null {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim()
  if (restUrl && token) {
    return { url: normalizeRedisRestUrl(restUrl), token }
  }

  const connectionUrl =
    process.env.UPSTASH_REDIS_URL?.trim() || process.env.KV_URL?.trim() || process.env.REDIS_URL?.trim()
  if (connectionUrl) {
    return parseRedisConnectionUrl(connectionUrl)
  }

  return null
}