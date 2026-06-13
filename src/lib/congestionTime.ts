import type { CongestionItem } from '../types/congestion'

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function getItemProcessTime(item: CongestionItem): string | undefined {
  for (const [key, value] of Object.entries(item)) {
    if (key === '_source') continue
    if (normalizeKey(key) === 'prchr' && value) return value
  }
  return undefined
}

export function getAirportCodeFromItem(item: CongestionItem): string | undefined {
  for (const [key, value] of Object.entries(item)) {
    if (key === '_source') continue
    const nk = normalizeKey(key)
    if ((nk === 'iataapcd' || nk === 'airportcode' || nk === 'airport') && value) {
      return value.toUpperCase()
    }
  }
  return undefined
}

export function parseTimeToMinutes(timeStr: string): number | null {
  const trimmed = timeStr.trim()
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (colonMatch) {
    return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10)
  }
  const compactMatch = trimmed.match(/^(\d{2})(\d{2})$/)
  if (compactMatch) {
    return parseInt(compactMatch[1], 10) * 60 + parseInt(compactMatch[2], 10)
  }
  return null
}

export function formatMinutesAsTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function getDefaultDepartureDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDefaultDepartureTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export interface DepartureFilterResult {
  items: CongestionItem[]
  requestedLabel: string
  matchedTimes: string[]
  isExactMatch: boolean
}

export function filterItemsByDepartureTime(
  items: CongestionItem[],
  departureDate: string,
  departureTime: string,
): DepartureFilterResult {
  const targetMinutes = parseTimeToMinutes(departureTime)
  const requestedLabel = `${departureDate} ${departureTime}`

  if (targetMinutes === null) {
    return { items: [], requestedLabel, matchedTimes: [], isExactMatch: false }
  }

  const byAirport = new Map<string, CongestionItem[]>()
  for (const item of items) {
    const code = getAirportCodeFromItem(item) ?? `${item._source}-${byAirport.size}`
    const list = byAirport.get(code) ?? []
    list.push(item)
    byAirport.set(code, list)
  }

  const result: CongestionItem[] = []
  const matchedTimes = new Set<string>()
  let exactCount = 0
  let matchedCount = 0

  for (const airportItems of byAirport.values()) {
    const timedItems = airportItems
      .map((item) => {
        const timeStr = getItemProcessTime(item)
        const minutes = timeStr ? parseTimeToMinutes(timeStr) : null
        return minutes === null ? null : { item, minutes, timeStr: timeStr! }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    if (timedItems.length === 0) {
      result.push(airportItems[0])
      continue
    }

    const exact = timedItems.find((entry) => entry.minutes === targetMinutes)
    const picked = exact ?? timedItems.reduce((best, cur) =>
      Math.abs(cur.minutes - targetMinutes) < Math.abs(best.minutes - targetMinutes) ? cur : best,
    )

    result.push(picked.item)
    matchedTimes.add(picked.timeStr)
    matchedCount += 1
    if (exact) exactCount += 1
  }

  const times = [...matchedTimes].sort()
  const isExactMatch = matchedCount > 0 && exactCount === matchedCount && times.length === 1 && times[0] === departureTime

  return {
    items: result,
    requestedLabel,
    matchedTimes: times,
    isExactMatch,
  }
}

export function buildFilterMessage(result: DepartureFilterResult): string {
  if (result.items.length === 0) {
    return `${result.requestedLabel} 출발 · 표시할 혼잡도 데이터가 없습니다.`
  }
  if (result.isExactMatch) {
    return `${result.requestedLabel} 출발 기준 예상 혼잡도입니다.`
  }
  if (result.matchedTimes.length === 1) {
    return `${result.requestedLabel} 출발 요청 · API 제공 시각 ${result.matchedTimes[0]} 데이터를 표시합니다.`
  }
  return `${result.requestedLabel} 출발 요청 · 공항별 가장 가까운 시간대(${result.matchedTimes.join(', ')}) 데이터를 표시합니다.`
}
