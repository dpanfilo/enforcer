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
import type { JobData } from '@/lib/hoursData'

interface Props {
  data: JobData[]
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

function getColor(macro: string | undefined) {
  return MACRO_COLOR[macro ?? ''] ?? '#6b7280'
}

interface CustomTickProps {
  x?: number | string
  y?: number | string
  payload?: { value: string }
  data: JobData[]
  [key: string]: unknown
}

function CustomYTick({ x = 0, y = 0, payload, data }: CustomTickProps) {
  const numX = typeof x === 'string' ? parseFloat(x) : x
  const numY = typeof y === 'string' ? parseFloat(y) : y
  const job = data.find((d) => d.job === payload?.value)
  const label = job?.description ? `${job.job} — ${job.description}` : (payload?.value ?? '')
  const truncated = label.length > 32 ? label.slice(0, 30) + '…' : label
  return (
    <text x={numX} y={numY} dy={4} textAnchor="end" fill="#9ca3af" fontSize={10}>
      {truncated}
    </text>
  )
}

interface TooltipPayload {
  payload?: JobData
  value?: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d) return null
  return (
    <div className="rounded-lg border border-zinc-700 p-3 text-xs max-w-xs" style={{ backgroundColor: '#1a1d27' }}>
      <p className="font-semibold text-white mb-1">{d.job}</p>
      {d.description && <p className="text-zinc-300 mb-1">{d.description}</p>}
      {(d.city || d.state) && (
        <p className="text-zinc-400">{[d.city, d.state].filter(Boolean).join(', ')}</p>
      )}
      {d.status_name && (
        <p className="text-zinc-400 mt-1">
          Status: <span className="text-zinc-200">{d.status_name}</span>
        </p>
      )}
      {d.rush && <p className="text-orange-400 mt-1">⚡ Rush</p>}
      <p className="text-green-400 font-semibold mt-1">{d.hours}h</p>
    </div>
  )
}

export default function TopJobsChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="job"
          width={145}
          tick={(props) => <CustomYTick {...props} data={data} />}
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
