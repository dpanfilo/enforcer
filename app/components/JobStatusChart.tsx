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
} from 'recharts'
import type { StatusBreakdown } from '@/lib/hoursData'

interface Props {
  data: StatusBreakdown[]
}

const MACRO_COLOR: Record<string, string> = {
  backlog: '#3b82f6',
  cad: '#8b5cf6',
  blocked: '#ef4444',
  completed: '#22c55e',
  to_submit: '#f97316',
  submitted: '#06b6d4',
  invoiced: '#10b981',
}

function getColor(macro: string) {
  return MACRO_COLOR[macro] ?? '#6b7280'
}

interface TooltipPayload {
  payload?: StatusBreakdown
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d) return null
  return (
    <div className="rounded-lg border border-zinc-700 p-3 text-xs" style={{ backgroundColor: '#1a1d27' }}>
      <p className="font-semibold text-white mb-1">{d.status}</p>
      <p className="text-zinc-400">Macro: {d.macro_status || '—'}</p>
      <p className="text-zinc-400">{d.jobCount} job{d.jobCount !== 1 ? 's' : ''}</p>
      <p className="text-green-400 font-semibold mt-1">{d.hours}h</p>
    </div>
  )
}

export default function JobStatusChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="status"
          width={130}
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + '…' : v}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={getColor(d.macro_status)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
