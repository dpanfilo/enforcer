'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyData } from '@/lib/hoursData'

interface Props {
  data: MonthlyData[]
}

export default function MonthlyChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    month: d.month.slice(0, 7), // YYYY-MM already
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis
          dataKey="month"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          tickFormatter={(v) => {
            const [, mm] = v.split('-')
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            return months[parseInt(mm, 10) - 1] ?? v
          }}
        />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#e5e7eb' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Bar dataKey="straight" name="REG" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
        <Bar dataKey="overtime" name="OVT" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
