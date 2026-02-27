export const dynamic = 'force-dynamic'

import { fetchNicorClientData } from '@/lib/nicorClientDashboard'
import NicorVolumeChart from '@/app/components/NicorVolumeChart'
import TurnaroundChart from '@/app/components/TurnaroundChart'

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'green' | 'amber' | 'indigo' | 'red'
}) {
  const colors = {
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    indigo: 'text-indigo-400',
    red: 'text-red-400',
  }
  const valueClass = accent ? colors[accent] : 'text-white'
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a' }}
    >
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

function TurnaroundCard({
  title,
  stats,
  color,
}: {
  title: string
  stats: { avg: number; median: number; min: number; max: number; count: number }
  color: string
}) {
  const chartData = [
    { label: 'Avg', avg: stats.avg, median: stats.median },
    { label: 'Median', avg: stats.median, median: stats.median },
  ]
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a' }}
    >
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-xl font-bold" style={{ color }}>{stats.avg}</p>
          <p className="text-xs text-zinc-500">avg days</p>
        </div>
        <div>
          <p className="text-xl font-bold text-white">{stats.median}</p>
          <p className="text-xs text-zinc-500">median</p>
        </div>
        <div>
          <p className="text-xl font-bold text-zinc-300">{stats.min}</p>
          <p className="text-xs text-zinc-500">min</p>
        </div>
        <div>
          <p className="text-xl font-bold text-zinc-300">{stats.max}</p>
          <p className="text-xs text-zinc-500">max</p>
        </div>
      </div>
      <TurnaroundChart data={chartData} color={color} />
      <p className="text-xs text-zinc-600 text-right">Based on {stats.count} completed jobs</p>
    </div>
  )
}

export default async function NicorClientPage() {
  const data = await fetchNicorClientData()

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <main
      className="min-h-screen p-6 md:p-10 font-sans"
      style={{ backgroundColor: '#0a0d14', color: '#e5e7eb' }}
    >
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <div>
            <p className="text-xs text-emerald-500 font-semibold uppercase tracking-widest mb-1">
              Client Dashboard
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Nicor Permitting
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              NCP Project Performance Overview
            </p>
          </div>
          <p className="text-zinc-600 text-sm">Updated {today}</p>
        </div>

        {/* Top metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Jobs" value={data.totalJobs.toLocaleString()} accent="indigo" />
          <StatCard
            label="Permit Opened"
            value={data.jobsWithPermitOpen.toLocaleString()}
            sub={`${Math.round((data.jobsWithPermitOpen / data.totalJobs) * 100)}% of total`}
            accent="green"
          />
          <StatCard
            label="Closed"
            value={data.jobsWithClosed.toLocaleString()}
            sub={`${Math.round((data.jobsWithClosed / data.totalJobs) * 100)}% of total`}
            accent="amber"
          />
          <StatCard
            label="In Progress"
            value={data.jobsInProgress.toLocaleString()}
            sub="not yet closed"
          />
        </div>

        {/* Turnaround time cards */}
        <h2 className="text-lg font-semibold text-white mb-3">Turnaround Times</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <TurnaroundCard
            title="Received → Permit Open"
            stats={data.receivedToPermitOpen}
            color="#10b981"
          />
          <TurnaroundCard
            title="Permit Open → Closed"
            stats={data.permitOpenToClosed}
            color="#f59e0b"
          />
          <TurnaroundCard
            title="Overall (Received → Closed)"
            stats={data.overall}
            color="#6366f1"
          />
        </div>

        {/* Monthly Volume chart */}
        <div
          className="rounded-xl p-5 mb-8"
          style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a' }}
        >
          <h2 className="text-sm font-semibold text-white mb-4">Monthly Job Volume</h2>
          <NicorVolumeChart data={data.monthlyVolume} />
        </div>

        {/* Recent jobs table */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a' }}
        >
          <h2 className="text-sm font-semibold text-white mb-4">Recent Jobs (last 50)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                  <th className="pb-2 pr-4">Job #</th>
                  <th className="pb-2 pr-4">Received</th>
                  <th className="pb-2 pr-4">Permit Open</th>
                  <th className="pb-2 pr-4">Closed</th>
                  <th className="pb-2 pr-4 text-right">→ Open</th>
                  <th className="pb-2 pr-4 text-right">Open → Close</th>
                  <th className="pb-2 text-right">Overall</th>
                </tr>
              </thead>
              <tbody>
                {data.recentJobs.map((j) => (
                  <tr
                    key={j.jobNumber}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="py-2 pr-4 font-mono text-emerald-400 text-xs">{j.jobNumber}</td>
                    <td className="py-2 pr-4 text-zinc-300">{j.receivedDate || '—'}</td>
                    <td className="py-2 pr-4 text-zinc-300">{j.permitOpenDate || '—'}</td>
                    <td className="py-2 pr-4 text-zinc-300">{j.closedDate || '—'}</td>
                    <td className="py-2 pr-4 text-right">
                      {j.daysToPermitOpen !== null ? (
                        <span className={j.daysToPermitOpen > 30 ? 'text-amber-400' : 'text-emerald-400'}>
                          {j.daysToPermitOpen}d
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {j.daysPermitOpenToClosed !== null ? (
                        <span className={j.daysPermitOpenToClosed > 60 ? 'text-amber-400' : 'text-zinc-300'}>
                          {j.daysPermitOpenToClosed}d
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {j.daysOverall !== null ? (
                        <span className="text-zinc-300">{j.daysOverall}d</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  )
}
