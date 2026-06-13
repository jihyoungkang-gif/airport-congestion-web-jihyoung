import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CongestionChartPoint, OverviewChartPoint } from '../lib/congestionChart'
import { LEVEL_LABELS, levelToColor, levelToStatus } from '../lib/congestionChart'
import './CongestionChart.css'

interface TooltipPayload {
  payload: CongestionChartPoint
}

function AirportTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayload[]
}) {
  if (!active || !payload?.length) return null

  const point = payload[0].payload
  return (
    <div className="congestion-chart-tooltip">
      <p className="congestion-chart-tooltip__title">{point.fullLabel}</p>
      <p className="congestion-chart-tooltip__value">{point.status}</p>
    </div>
  )
}

interface OverviewTooltipEntry {
  name: string
  value: number
  color: string
  payload: OverviewChartPoint
}

function OverviewTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: OverviewTooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  const fullName = payload[0]?.payload?.fullName ?? label

  return (
    <div className="congestion-chart-tooltip">
      <p className="congestion-chart-tooltip__title">{fullName}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="congestion-chart-tooltip__row">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <strong>{levelToStatus(entry.value)}</strong>
        </p>
      ))}
    </div>
  )
}

function formatYAxisTick(value: number): string {
  return LEVEL_LABELS[value] ?? ''
}

export function AirportCongestionChart({ data }: { data: CongestionChartPoint[] }) {
  if (data.length === 0) return null

  return (
    <div className="congestion-chart congestion-chart--airport">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="section"
            tick={{ fontSize: 12, fill: 'var(--text)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 3.4]}
            ticks={[1, 2, 3]}
            tickFormatter={formatYAxisTick}
            tick={{ fontSize: 11, fill: 'var(--text)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<AirportTooltip />} cursor={{ fill: 'rgba(127, 127, 127, 0.08)' }} />
          <Bar dataKey="level" radius={[8, 8, 0, 0]} maxBarSize={64}>
            {data.map((entry) => (
              <Cell key={entry.section} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CongestionOverviewChart({ data }: { data: OverviewChartPoint[] }) {
  if (data.length === 0) return null

  return (
    <div className="congestion-chart congestion-chart--overview">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: 'var(--text)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 3.4]}
            ticks={[1, 2, 3]}
            tickFormatter={formatYAxisTick}
            tick={{ fontSize: 11, fill: 'var(--text)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<OverviewTooltip />} cursor={{ fill: 'rgba(127, 127, 127, 0.08)' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>}
          />
          <Bar dataKey="sectionA" name="체크인" radius={[4, 4, 0, 0]} maxBarSize={20}>
            {data.map((entry) => (
              <Cell key={`${entry.name}-a`} fill={levelToColor(entry.sectionA)} />
            ))}
          </Bar>
          <Bar dataKey="sectionB" name="신분확인" radius={[4, 4, 0, 0]} maxBarSize={20}>
            {data.map((entry) => (
              <Cell key={`${entry.name}-b`} fill={levelToColor(entry.sectionB)} />
            ))}
          </Bar>
          <Bar dataKey="sectionC" name="탑승" radius={[4, 4, 0, 0]} maxBarSize={20}>
            {data.map((entry) => (
              <Cell key={`${entry.name}-c`} fill={levelToColor(entry.sectionC)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
