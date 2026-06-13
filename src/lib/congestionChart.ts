export interface CongestionChartPoint {
  section: string
  fullLabel: string
  level: number
  status: string
  fill: string
}

export interface OverviewChartPoint {
  name: string
  fullName: string
  sectionA: number
  sectionB: number
  sectionC: number
  overall: number
}

export const SECTION_SHORT_LABELS = ['체크인', '신분확인', '탑승'] as const

export const LEVEL_LABELS: Record<number, string> = {
  1: '원활',
  2: '보통',
  3: '혼잡',
}

export function levelToColor(level: number): string {
  if (level >= 3) return '#ef4444'
  if (level >= 2) return '#eab308'
  return '#22c55e'
}

export function parseLevel(value: string): number {
  const num = Math.round(Number(value))
  if (Number.isNaN(num) || num < 1) return 0
  return Math.min(num, 3)
}

export function levelToStatus(level: number): string {
  return LEVEL_LABELS[level] ?? String(level)
}

export function buildChartPoints(
  sections: { label: string; value: string; display: string }[],
): CongestionChartPoint[] {
  return sections.map((section, index) => {
    const level = parseLevel(section.value)
    return {
      section: SECTION_SHORT_LABELS[index] ?? section.label,
      fullLabel: section.label,
      level,
      status: section.display,
      fill: levelToColor(level),
    }
  })
}

export function buildOverviewPoints(
  airports: { name: string; fullName: string; levels: number[]; overall: number }[],
): OverviewChartPoint[] {
  return airports.map(({ name, fullName, levels, overall }) => ({
    name,
    fullName,
    sectionA: levels[0] ?? 0,
    sectionB: levels[1] ?? 0,
    sectionC: levels[2] ?? 0,
    overall,
  }))
}
