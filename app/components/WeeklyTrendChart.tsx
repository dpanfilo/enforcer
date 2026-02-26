'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import type { WeeklyTrend } from '@/lib/hoursData'

interface Props { data: WeeklyTrend[] }

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 },
  labelStyle: { color: '#e5e7eb' },
  itemStyle: { color: '#e5e7eb' },
}

export default function WeeklyTrendChart({ data }: Props) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-4">
        REG capped at 40h/week (Mon–Sun) · dashed line = 40h threshold
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            interval={1}
            angle={-40}
            textAnchor="end"
            height={48}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number | undefined, name: string | undefined) => [
              `${v ?? 0}h`,
              name === 'straight' ? 'REG' : 'OVT',
            ]}
            labelFormatter={(w) => `Week of ${w}`}
          />
          <Legend
            formatter={(v) => v === 'straight' ? 'REG' : 'OVT'}
            wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
          />
          <ReferenceLine
            y={40}
            stroke="#6b7280"
            strokeDasharray="4 4"
            label={{ value: '40h', fill: '#6b7280', fontSize: 10, position: 'right' }}
          />
          <Bar dataKey="straight" stackId="a" fill="#3b82f6" />
          <Bar dataKey="overtime" stackId="a" fill="#f97316" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
