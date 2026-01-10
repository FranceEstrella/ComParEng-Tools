import AnalyticsClient from "./AnalyticsClient"

export default function AnalyticsPage({
  searchParams,
}: {
  searchParams?: { key?: string | string[] }
}) {
  const rawKey = searchParams?.key
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey
  return <AnalyticsClient initialKey={key} />
}
