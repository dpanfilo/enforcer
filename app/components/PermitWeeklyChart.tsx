'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import type { PermitWeek } from '@/lib/permitData'

interface Props {
  data: PermitWeek[]
}

interface TooltipPayload {
  payload?: PermitWeek
  value?: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d) return null
  return (
    <div
      className="rounded-lg border border-zinc-700 p-3 text-xs"
      style={{ backgroundColor: '#1a1d27' }}
    >
      <p className="font-semibold text-white mb-1">Week of {d.week}</p>
      <p className="text-emerald-400 font-semibold">{d.jobs} job{d.jobs !== 1 ? 's' : ''} sent to permit</p>
    </div>
  )
}

const avg = (data: PermitWeek[]) => {
  const nonZero = data.filter((d) => d.jobs > 0)
  return nonZero.length ? Math.round((nonZero.reduce((s, d) => s + d.jobs, 0) / nonZero.length) * 10) / 10 : 0
}

export default function PermitWeeklyChart({ data }: Props) {
  const weeklyAvg = avg(data)

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-4">
        Unique jobs moved to "To Permit" status per week · avg {weeklyAvg}/active week · Nov 4 bulk migration excluded
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            interval={0}
            angle={-40}
            textAnchor="end"
            height={48}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={weeklyAvg}
            stroke="#6b7280"
            strokeDasharray="4 4"
            label={{ value: `avg ${weeklyAvg}`, fill: '#6b7280', fontSize: 10, position: 'right' }}
          />
          <Bar dataKey="jobs" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.jobs === 0 ? '#2a2d3a' : d.jobs >= 25 ? '#22c55e' : '#10b981'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
