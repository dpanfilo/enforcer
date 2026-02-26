'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { AdminBreakdownData } from '@/lib/hoursData'

interface Props { data: AdminBreakdownData }

const DRIVING_CODE = 'Driving'

interface TT { active?: boolean; payload?: { payload: { code: string; hours: number; pct: number } }[] }
function CustomTooltip({ active, payload }: TT) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-zinc-700 p-3 text-xs" style={{ backgroundColor: '#1a1d27' }}>
      <p className="font-semibold text-white mb-1">{d.code}</p>
      <p className="text-amber-400">{d.hours}h</p>
      <p className="text-zinc-400">{d.pct}% of all hours</p>
    </div>
  )
}

export default function AdminCodeChart({ data }: Props) {
  const summaryData = [
    { label: 'Project / Billable', hours: data.billableTotal, color: '#22c55e' },
    { label: 'Admin / Non-Billable', hours: data.adminTotal, color: '#f59e0b' },
  ]

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-4">
        {data.adminPct}% of all hours ({data.adminTotal}h) are on non-billable admin codes ·
        {' '}{100 - data.adminPct}% ({data.billableTotal}h) on project work
      </p>

      {/* Summary: Billable vs Admin */}
      <div className="flex gap-4 mb-2">
        {summaryData.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-zinc-300">{s.label} — <span className="font-semibold">{s.hours}h</span></span>
          </div>
        ))}
      </div>

      {/* Stacked summary bar */}
      <div className="flex rounded overflow-hidden h-5 mb-6">
        <div
          className="transition-all"
          style={{ width: `${100 - data.adminPct}%`, backgroundColor: '#22c55e' }}
          title={`Billable: ${data.billableTotal}h`}
        />
        <div
          className="transition-all"
          style={{ width: `${data.adminPct}%`, backgroundColor: '#f59e0b' }}
          title={`Admin: ${data.adminTotal}h`}
        />
      </div>

      {/* Per-code breakdown */}
      <p className="text-xs font-medium text-zinc-400 mb-2">Admin codes breakdown</p>
      <ResponsiveContainer width="100%" height={Math.max(200, data.breakdown.length * 30 + 40)}>
        <BarChart
          layout="vertical"
          data={data.breakdown}
          margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="code"
            width={180}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="hours" radius={[0, 4, 4, 0]}
            label={{ position: 'right', fill: '#9ca3af', fontSize: 10, formatter: (v: unknown) => `${v}h` }}
          >
            {data.breakdown.map((d, i) => (
              <Cell key={i} fill={d.code === DRIVING_CODE ? '#ef4444' : '#f59e0b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
