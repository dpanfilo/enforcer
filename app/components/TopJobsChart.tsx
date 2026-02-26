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
import type { JobData } from '@/lib/hoursData'

interface Props {
  data: JobData[]
}

export default function TopJobsChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={360}>
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
          width={120}
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + '…' : v}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#e5e7eb' }}
          formatter={(v: number | undefined) => [`${v ?? 0} hrs`, 'Hours']}
        />
        <Bar dataKey="hours" fill="#22c55e" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
