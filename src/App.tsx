import { useCallback, useEffect, useState } from 'react'
import { AirportCongestionChart, CongestionOverviewChart } from './components/CongestionChart'
import {
  DepartureTimePicker,
} from './components/DepartureTimePicker'
import { getDefaultDepartureDate, getDefaultDepartureTime } from './lib/congestionTime'
import { buildChartPoints, buildOverviewPoints, parseLevel } from './lib/congestionChart'
import {
  buildFilterMessage,
  filterItemsByDepartureTime,
} from './lib/congestionTime'
import type { CongestionItem } from './types/congestion'
import './App.css'

interface ApiHeader {
  resultCode: string
  resultMsg: string
}

interface ApiBody {
  items?: unknown
  item?: unknown
  totalCount?: number | string
}

interface ApiResponse {
  response: {
    header: ApiHeader
    body: ApiBody
  }
}

const API_ENDPOINTS = [
  {
    path: 'v1',
    title: '김포 · 제주',
    description: '국내선 출국 동선 혼잡도',
    airports: ['GMP', 'CJU'],
  },
  {
    path: 'v2',
    title: '김해 · 청주 · 대구',
    description: '국내선 출국 동선 혼잡도',
    airports: ['PUS', 'CJJ', 'TAE'],
  },
] as const

const AIRPORT_NAMES: Record<string, string> = {
  GMP: '김포국제공항',
  CJU: '제주국제공항',
  PUS: '김해국제공항',
  CJJ: '청주국제공항',
  TAE: '대구국제공항',
}

const AIRPORT_CODE_KEYS = [
  'IATA_APCD', 'iataApcd',
  'arp', 'arptCd', 'iataCd', 'apcd',
  'airport', 'airportCode', 'airportCd', 'airportIata', 'iata',
]

const AIRPORT_NAME_KEYS = [
  'airportName', 'airportKor', 'airportKorNm', 'airportKorName',
  'aptNm', 'aptName', 'arptNm', 'arptKorNm', 'arptName',
]

const TITLE_KEYS = [
  ...AIRPORT_NAME_KEYS,
  'depPublicFacNm', 'facNm', 'facilityName', 'locNm', 'gateNm', 'depArea',
  'terminal', 'terminalName', 'terminalNm', 'trmnlNm',
]

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const SECTION_FIELDS: { keys: string[]; label: string; kind: 'level' | 'time' }[] = [
  {
    label: '체크인 ~ 신분확인',
    kind: 'level',
    keys: [
      'CGDR_A_LVL', 'cgdrALvl',
      'interval1', 'processTime1', 'waitTime1', 'congestion1',
    ],
  },
  {
    label: '신분확인 ~ 보안검색',
    kind: 'level',
    keys: [
      'CGDR_B_LVL', 'cgdrBLvl',
      'interval2', 'processTime2', 'waitTime2', 'congestion2',
    ],
  },
  {
    label: '보안검색 ~ 탑승',
    kind: 'level',
    keys: [
      'CGDR_C_LVL', 'cgdrCLvl',
      'interval3', 'processTime3', 'waitTime3', 'congestion3',
    ],
  },
]

const OVERALL_LEVEL_KEYS = ['CGDR_ALL_LVL', 'cgdrAllLvl']

function flattenRawItem(raw: Record<string, unknown>): Record<string, string> {
  const flat: Record<string, string> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (value == null || value === '') continue

    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flat, flattenRawItem(value as Record<string, unknown>))
      continue
    }

    flat[key] = String(value)
  }

  return flat
}

function normalizeItem(raw: unknown, source: string): CongestionItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const item: CongestionItem = { _source: source, ...flattenRawItem(raw as Record<string, unknown>) }

  return Object.keys(item).length > 1 ? item : null
}

function normalizeItems(raw: unknown, source: string): CongestionItem[] {
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => {
      const item = normalizeItem(entry, source)
      return item ? [item] : []
    })
  }
  const item = normalizeItem(raw, source)
  return item ? [item] : []
}

function extractItems(data: ApiResponse, source: string): CongestionItem[] {
  const body = data.response?.body
  if (!body) return []

  const { items, item } = body

  if (Array.isArray(items)) return normalizeItems(items, source)
  if (items && typeof items === 'object' && 'item' in items) {
    return normalizeItems((items as { item?: unknown }).item, source)
  }
  if (typeof items === 'string' || items == null) {
    return normalizeItems(item, source)
  }
  return normalizeItems(item, source)
}

function isApiSuccess(resultCode: string | number | undefined): boolean {
  return String(resultCode) === '00'
}

function getItemValue(item: CongestionItem, keys: string[]): string | undefined {
  const normalizedMap = new Map(
    Object.entries(item).map(([key, value]) => [normalizeKey(key), value]),
  )

  for (const key of keys) {
    const value = normalizedMap.get(normalizeKey(key))
    if (value) return value
  }
  return undefined
}

function getAirportCode(item: CongestionItem): string | undefined {
  const code = getItemValue(item, AIRPORT_CODE_KEYS)
  return code?.toUpperCase()
}

function inferAirportFromText(item: CongestionItem): string | undefined {
  const hints = [
    { keyword: '김포', label: '김포국제공항' },
    { keyword: '제주', label: '제주국제공항' },
    { keyword: '김해', label: '김해국제공항' },
    { keyword: '청주', label: '청주국제공항' },
    { keyword: '대구', label: '대구국제공항' },
  ]

  for (const value of Object.values(item)) {
    for (const hint of hints) {
      if (value.includes(hint.keyword)) return hint.label
    }
  }

  return undefined
}

function getCardTitle(item: CongestionItem, index: number): string {
  const code = getAirportCode(item)
  if (code && AIRPORT_NAMES[code]) return AIRPORT_NAMES[code]

  const title = getItemValue(item, TITLE_KEYS)
  if (title) return title

  if (code) return code

  const inferred = inferAirportFromText(item)
  if (inferred) return inferred

  const endpoint = API_ENDPOINTS.find((entry) => entry.path === item._source)
  if (endpoint) return `${endpoint.title} · ${index + 1}`

  return `혼잡도 정보 · ${index + 1}`
}

function getTerminalLabel(item: CongestionItem): string | undefined {
  return getItemValue(item, ['terminal', 'terminalName', 'terminalNm', 'trmnlNm'])
}

function getUpdatedAt(item: CongestionItem): string | undefined {
  const prcHr = getItemValue(item, ['PRC_HR', 'prcHr'])
  if (prcHr) return `${prcHr} 기준`

  const date = getItemValue(item, ['sysGetDate', 'updateDate', 'operatingDate'])
  const time = getItemValue(item, ['sysGetTime', 'updateTime', 'operatingTime', 'std'])
  if (date && time) return `${date} ${time}`
  return time ?? date
}

function getCongestionLevel(num: number): 'low' | 'medium' | 'high' {
  if (num >= 3) return 'high'
  if (num >= 2) return 'medium'
  return 'low'
}

function formatCongestionLevel(value: string): { display: string; level: 'low' | 'medium' | 'high' } {
  const num = Math.round(Number(value))
  return {
    display: num === 1 ? '원활' : num === 2 ? '보통' : num >= 3 ? '혼잡' : value,
    level: getCongestionLevel(num),
  }
}

function getWaitLevel(minutes: number): 'low' | 'medium' | 'high' {
  if (minutes >= 40) return 'high'
  if (minutes >= 20) return 'medium'
  return 'low'
}

function formatWaitValue(value: string): { display: string; level: 'low' | 'medium' | 'high' } {
  const num = Number(value.replace(/[^\d.]/g, ''))
  if (!Number.isNaN(num) && value.match(/\d/)) {
    return { display: `${num}분`, level: getWaitLevel(num) }
  }

  const text = value.toLowerCase()
  if (text.includes('혼잡') || text.includes('crowded')) {
    return { display: value, level: 'high' }
  }
  if (text.includes('보통') || text.includes('moderate')) {
    return { display: value, level: 'medium' }
  }
  return { display: value, level: 'low' }
}

function formatSectionValue(
  value: string,
  kind: 'level' | 'time',
): { display: string; level: 'low' | 'medium' | 'high' } {
  if (kind === 'level') {
    const num = Number(value)
    if (!Number.isNaN(num) && num >= 1 && num <= 5) {
      return formatCongestionLevel(value)
    }
  }
  return formatWaitValue(value)
}

function getOverallLevel(item: CongestionItem) {
  const value = getItemValue(item, OVERALL_LEVEL_KEYS)
  if (!value) return undefined
  return formatCongestionLevel(value)
}

function getSectionFields(item: CongestionItem) {
  const usedKeys = new Set<string>()

  const sections = SECTION_FIELDS.map((section) => {
    const value = getItemValue(item, section.keys)
    if (!value) return null

    section.keys.forEach((key) => usedKeys.add(normalizeKey(key)))

    return {
      label: section.label,
      value,
      ...formatSectionValue(value, section.kind),
    }
  }).filter((section): section is NonNullable<typeof section> => section != null)

  return { sections }
}

/** .env의 Base URL(전체 URL 또는 /api 프록시 경로)로 엔드포인트 URL 생성 */
function buildEndpointUrl(path: string): URL {
  let baseUrl = import.meta.env.VITE_BASE_URL.trim().replace(/\/$/, '')

  // 개발 환경: apis.data.go.kr 직접 URL → Vite 프록시(/api)로 변환 (CORS 방지)
  if (import.meta.env.DEV && baseUrl.includes('apis.data.go.kr')) {
    baseUrl = baseUrl.replace(/^https?:\/\/apis\.data\.go\.kr/, '/api')
  }

  const endpoint = `${baseUrl}/${path}`
  return endpoint.startsWith('http')
    ? new URL(endpoint)
    : new URL(endpoint, window.location.origin)
}

async function fetchCongestionEndpoint(
  path: string,
  source: string,
): Promise<CongestionItem[]> {
  const apiKey = import.meta.env.VITE_API_KEY
  const baseUrl = import.meta.env.VITE_BASE_URL

  if (!apiKey || !baseUrl || apiKey.startsWith('[')) {
    throw new Error('.env 파일에 VITE_BASE_URL과 VITE_API_KEY를 설정해 주세요.')
  }

  const url = buildEndpointUrl(path)
  url.searchParams.set('serviceKey', apiKey)
  url.searchParams.set('type', 'json')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '100')

  const response = await fetch(url.toString(), { method: 'GET' })
  if (!response.ok) {
    throw new Error(`${source} API 오류: HTTP ${response.status}`)
  }

  const rawText = await response.text()
  let data: ApiResponse

  try {
    data = JSON.parse(rawText) as ApiResponse
  } catch {
    throw new Error(`${source} API 응답을 JSON으로 읽을 수 없습니다.`)
  }

  const header = data.response?.header
  if (!header) {
    throw new Error(`${source} API 응답 형식이 올바르지 않습니다.`)
  }

  if (!isApiSuccess(header.resultCode)) {
    throw new Error(header.resultMsg ?? `${source} API 오류`)
  }

  const items = extractItems(data, source)
  console.log(`[${source}]`, data)
  console.log(`[${source}] 추출 건수: ${items.length}`)
  return items
}

async function fetchKacCongestion(): Promise<CongestionItem[]> {
  const results = await Promise.all(
    API_ENDPOINTS.map((endpoint) =>
      fetchCongestionEndpoint(endpoint.path, endpoint.path),
    ),
  )

  return results.flat()
}

function getShortAirportName(item: CongestionItem, index: number): string {
  const full = getCardTitle(item, index)
  return full.replace('국제공항', '').replace('공항', '').trim() || full
}

function buildGroupOverviewData(items: CongestionItem[]) {
  return buildOverviewPoints(
    items.map((item, index) => {
      const { sections } = getSectionFields(item)
      const overallValue = getItemValue(item, OVERALL_LEVEL_KEYS)
      return {
        name: getShortAirportName(item, index),
        fullName: getCardTitle(item, index),
        levels: sections.map((section) => parseLevel(section.value)),
        overall: overallValue ? parseLevel(overallValue) : 0,
      }
    }),
  )
}

function groupByEndpoint(items: CongestionItem[]) {
  return API_ENDPOINTS.map((endpoint) => ({
    ...endpoint,
    items: items.filter((item) => item._source === endpoint.path),
  })).filter((group) => group.items.length > 0)
}

function CongestionCard({ item, index }: { item: CongestionItem; index: number }) {
  const { sections } = getSectionFields(item)
  const terminal = getTerminalLabel(item)
  const updatedAt = getUpdatedAt(item)
  const overall = getOverallLevel(item)
  const chartData = buildChartPoints(sections)

  return (
    <article className="congestion-card">
      <header className="congestion-card__header">
        <div>
          <h3>{getCardTitle(item, index)}</h3>
          {terminal && <p className="congestion-card__sub">{terminal}</p>}
        </div>
        <div className="congestion-card__meta">
          {overall && (
            <span className={`congestion-badge congestion-badge--${overall.level}`}>
              종합 {overall.display}
            </span>
          )}
          {updatedAt && <span className="congestion-card__date">{updatedAt}</span>}
        </div>
      </header>

      {chartData.length > 0 ? (
        <section className="congestion-card__section">
          <h4>동선별 혼잡도</h4>
          <AirportCongestionChart data={chartData} />
        </section>
      ) : (
        <section className="congestion-card__section">
          <p className="congestion-card__empty">표시할 혼잡도 데이터가 없습니다.</p>
        </section>
      )}
    </article>
  )
}

function CongestionDashboard({
  items,
  filterMessage,
}: {
  items: CongestionItem[]
  filterMessage?: string
}) {
  const endpointGroups = groupByEndpoint(items)

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>선택한 시간대에 표시할 혼잡도 데이터가 없습니다.</p>
        <p className="empty-state__hint">
          다른 출발 시간을 선택해 보세요. API는 시간(PRC_HR) 단위로 혼잡도를 제공합니다.
        </p>
      </div>
    )
  }

  return (
    <div className="congestion-dashboard">
      {filterMessage && (
        <p className="filter-message" role="status">
          {filterMessage}
        </p>
      )}
      <div className="congestion-legend">
        <span className="congestion-legend__item congestion-legend__item--low">원활</span>
        <span className="congestion-legend__item congestion-legend__item--medium">보통</span>
        <span className="congestion-legend__item congestion-legend__item--high">혼잡</span>
      </div>

      {endpointGroups.map((group) => (
        <section key={group.path} className="congestion-day">
          <h2 className="congestion-day__title">
            {group.title}
            <span className="congestion-day__count">{group.items.length}개 공항</span>
          </h2>
          <p className="congestion-day__desc">{group.description}</p>
          {group.items.length > 1 && (
            <CongestionOverviewChart data={buildGroupOverviewData(group.items)} />
          )}
          <div className="congestion-grid">
            {group.items.map((item, index) => (
              <CongestionCard key={`${group.path}-${getAirportCode(item) ?? index}`} item={item} index={index} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function App() {
  const [allItems, setAllItems] = useState<CongestionItem[]>([])
  const [displayItems, setDisplayItems] = useState<CongestionItem[]>([])
  const [departureDate, setDepartureDate] = useState(getDefaultDepartureDate)
  const [departureTime, setDepartureTime] = useState(getDefaultDepartureTime)
  const [filterMessage, setFilterMessage] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const runFilter = useCallback((date: string, time: string) => {
    const result = filterItemsByDepartureTime(allItems, date, time)
    setDisplayItems(result.items)
    setFilterMessage(buildFilterMessage(result))
    setHasSearched(true)
  }, [allItems])

  const applyDepartureFilter = useCallback(() => {
    runFilter(departureDate, departureTime)
  }, [departureDate, departureTime, runFilter])

  const resetToNow = useCallback(() => {
    const nowDate = getDefaultDepartureDate()
    const nowTime = getDefaultDepartureTime()
    setDepartureDate(nowDate)
    setDepartureTime(nowTime)
    runFilter(nowDate, nowTime)
  }, [runFilter])

  useEffect(() => {
    void (async () => {
      try {
        const result = await fetchKacCongestion()
        setAllItems(result)
        console.log(`전체 추출 건수: ${result.length}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <main className="app">
      <header className="app-header">
        <h1>공항 혼잡도</h1>
        <p>한국공항공사 실시간 출국 혼잡도 · 김포 · 제주 · 김해 · 청주 · 대구</p>
      </header>

      {loading && <p className="status-message">불러오는 중...</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <DepartureTimePicker
            date={departureDate}
            time={departureTime}
            onDateChange={setDepartureDate}
            onTimeChange={setDepartureTime}
            onSubmit={applyDepartureFilter}
            onResetToNow={resetToNow}
            loading={allItems.length === 0}
          />

          {!hasSearched && (
            <p className="status-message">
              출발 날짜와 시간을 선택한 뒤 「이 시간대 혼잡도 보기」를 눌러 주세요.
            </p>
          )}

          {hasSearched && (
            <CongestionDashboard items={displayItems} filterMessage={filterMessage ?? undefined} />
          )}
        </>
      )}
    </main>
  )
}

export default App
