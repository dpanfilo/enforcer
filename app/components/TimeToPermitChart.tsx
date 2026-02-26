'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TimeToPermitData } from '@/lib/timeToPermit'

interface Props { data: TimeToPermitData }

export default function TimeToPermitChart({ data }: Props) {
  if (!data.jobs.length) {
    return <p className="text-zinc-500 text-sm py-4 text-center">No jobs with both hours and a permit submission found.</p>
  }

  return (
    <div>
      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-zinc-800 border border-zinc-600">
          <span className="text-white font-bold text-lg">{data.median}</span>
          <span className="text-zinc-400 text-xs">Median days</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-zinc-800 border border-zinc-600">
          <span className="text-white font-bold text-lg">{data.avg}</span>
          <span className="text-zinc-400 text-xs">Avg days</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-zinc-800 border border-zinc-600">
          <span className="text-white font-bold text-lg">{data.jobs.length}</span>
          <span className="text-zinc-400 text-xs">Jobs analyzed</span>
        </div>
      </div>

      {/* Histogram */}
      <p className="text-xs font-medium text-zinc-400 mb-2">Distribution — days from first hours entry to permit submission</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data.buckets} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#a855f7' }}
            formatter={(v: number | undefined) => [`${v ?? 0} jobs`, 'Count']}
          />
          <Bar dataKey="count" fill="#a855f7" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Slowest jobs table */}
      {data.slowest.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium text-zinc-400 mb-2">Slowest jobs (most days between first hours and permit)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-400 text-left border-b border-zinc-800">
                  <th className="pb-2 pr-4 font-medium">Job</th>
                  <th className="pb-2 pr-4 font-medium">Description</th>
                  <th className="pb-2 pr-4 font-medium">First Hours</th>
                  <th className="pb-2 pr-4 font-medium">Permit Date</th>
                  <th className="pb-2 font-medium text-right">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.slowest.map((j, i) => (
                  <tr key={j.fullNumber} className="hover:bg-zinc-800/50">
                    <td className="py-2 pr-4 font-mono font-semibold text-emerald-300">{j.fullNumber}</td>
                    <td className="py-2 pr-4 text-zinc-300 max-w-xs truncate" title={j.description}>
                      {j.description || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">{j.firstHoursDate}</td>
                    <td className="py-2 pr-4 text-zinc-400">{j.permitDate}</td>
                    <td className={`py-2 text-right font-bold ${i < 3 ? 'text-red-400' : i < 6 ? 'text-orange-400' : 'text-zinc-300'}`}>
                      {j.daysToPermit}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
