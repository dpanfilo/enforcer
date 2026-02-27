'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

interface Props {
  data: { label: string; avg: number; median: number }[]
  color: string
}

export default function TurnaroundChart({ data, color }: Props) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          label={{ value: 'days', position: 'insideRight', offset: -4, fill: '#6b7280', fontSize: 11 }}
        />
        <YAxis type="category" dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} width={60} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          formatter={(v: number | undefined) => [`${v ?? 0} days`]}
        />
        <Bar dataKey="avg" name="Avg" radius={[0,4,4,0]}>
          {data.map((_, i) => <Cell key={i} fill={color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
