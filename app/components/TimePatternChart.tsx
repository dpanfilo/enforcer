'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { HourCount } from '@/lib/hoursData'

interface Props {
  startHours: HourCount[]
  endHours: HourCount[]
}

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 },
  labelStyle: { color: '#e5e7eb' },
  itemStyle: { color: '#e5e7eb' },
}

function HourChart({ data, color, label }: { data: HourCount[]; color: string; label: string }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-zinc-400 mb-2 text-center">{label}</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickFormatter={(h) => `${h}:00`}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number | undefined) => [`${v ?? 0} days`, 'Count']}
            labelFormatter={(h) => `${h}:00`}
          />
          <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function TimePatternChart({ startHours, endHours }: Props) {
  return (
    <div className="flex gap-4">
      <HourChart data={startHours} color="#3b82f6" label="Start Time Distribution" />
      <HourChart data={endHours} color="#f97316" label="End Time Distribution" />
    </div>
  )
}
