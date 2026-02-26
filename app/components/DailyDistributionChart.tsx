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
import type { BucketData } from '@/lib/hoursData'

interface Props {
  data: BucketData[]
}

export default function DailyDistributionChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis dataKey="bucket" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#e5e7eb' }}
          formatter={(v: number | undefined) => [`${v ?? 0} days`, 'Days']}
        />
        <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
