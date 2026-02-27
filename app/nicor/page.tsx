export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { nameToSlug } from '@/lib/employees'
import { fetchHoursData } from '@/lib/hoursData'
import MetricCard from '../components/MetricCard'
import MonthlyChart from '../components/MonthlyChart'
import PrintButton from '../components/PrintButton'

const NICOR_TEAM = [
  'Jovani Mendoza',
  'Karolina Guerrero',
  'Humberto Vazquez',
  'Nara Dugar',
  'Lourdes Aguirre',
]

export default async function NicorPage() {
  const results = await Promise.all(
    NICOR_TEAM.map(async (name) => {
      try {
        const data = await fetchHoursData(name)
        return { name, data, error: null }
      } catch {
        return { name, data: null, error: 'No data found' }
      }
    })
  )

  const valid = results.filter((r) => r.data !== null)

  // ── Combined metrics ──────────────────────────────────────────────────────
  const totalHours    = Math.round(valid.reduce((s, r) => s + r.data!.metrics.totalHours,    0) * 100) / 100
  const totalStraight = Math.round(valid.reduce((s, r) => s + r.data!.metrics.straightHours, 0) * 100) / 100
  const totalOT       = Math.round(valid.reduce((s, r) => s + r.data!.metrics.overtimeHours, 0) * 100) / 100
  const totalDays     = valid.reduce((s, r) => s + r.data!.metrics.totalDays,    0)
  const totalWeekend  = valid.reduce((s, r) => s + r.data!.metrics.weekendDays,  0)
  const totalOver8    = valid.reduce((s, r) => s + r.data!.metrics.daysOver8,    0)

  // ── Combined monthly chart data ───────────────────────────────────────────
  const allMonths = new Set<string>()
  for (const { data } of valid) for (const m of data!.monthly) allMonths.add(m.month)

  const combinedMonthly = [...allMonths].sort().map((month) => {
    let straight = 0, overtime = 0, days = 0
    for (const { data } of valid) {
      const m = data!.monthly.find((x) => x.month === month)
      if (m) { straight += m.straight; overtime += m.overtime; days += m.days }
    }
    return {
      month,
      straight: Math.round(straight * 100) / 100,
      overtime: Math.round(overtime * 100) / 100,
      days,
    }
  })

  // ── Date range ────────────────────────────────────────────────────────────
  const formatMonth = (ym: string) => {
    if (!ym) return ''
    const [y, m] = ym.split('-')
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${names[parseInt(m, 10) - 1]} ${y}`
  }
  const firstMonth = combinedMonthly[0]?.month ?? ''
  const lastMonth  = combinedMonthly[combinedMonthly.length - 1]?.month ?? ''
  const dateRange  = firstMonth && lastMonth ? `${formatMonth(firstMonth)} – ${formatMonth(lastMonth)}` : ''

  return (
    <main
      className="min-h-screen p-6 md:p-10 font-sans"
      style={{ backgroundColor: '#0f1117', color: '#e5e7eb' }}
    >
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm mb-1 block print:hidden">
            ← All Employees
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Nicor Permitting · Team Dashboard
          </h1>
          {dateRange && (
            <p className="text-zinc-400 text-sm mt-1">{dateRange} · {NICOR_TEAM.length} employees</p>
          )}
        </div>
        <PrintButton />
      </div>

      {/* Combined metric cards */}
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        Combined Team Totals
      </h2>
      <div className="metric-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <MetricCard label="Total Hours"    value={`${totalHours}h`} />
        <MetricCard label="Regular (REG)"  value={`${totalStraight}h`} />
        <MetricCard label="Overtime (OVT)" value={`${totalOT}h`} highlight={totalOT > 500} />
        <MetricCard label="Total Days"     value={totalDays} />
        <MetricCard label="Weekend Days"   value={totalWeekend} highlight={totalWeekend > 0} />
        <MetricCard label="Days Over 8h"   value={totalOver8} highlight={true} />
      </div>

      {/* Combined monthly chart */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Combined Monthly Hours — REG vs OVT
        </h2>
        <MonthlyChart data={combinedMonthly} />
      </section>

      {/* Individual employee cards */}
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        Individual Breakdown
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map(({ name, data, error }) => {
          const pct  = data && totalHours > 0
            ? Math.round((data.metrics.totalHours / totalHours) * 100)
            : 0
          const slug = nameToSlug(name)

          return (
            <div
              key={name}
              style={{ backgroundColor: '#1a1d27' }}
              className="rounded-xl p-5 border border-zinc-700/40"
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{pct}% of team hours</p>
                </div>
                <Link
                  href={`/${slug}`}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors print:hidden"
                >
                  Full dashboard →
                </Link>
              </div>

              {error ? (
                <p className="text-zinc-500 text-xs italic">{error}</p>
              ) : data ? (
                <>
                  {/* Share bar */}
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-4">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-y-3 gap-x-2">
                    <div>
                      <p className="text-xs text-zinc-500">Total Hrs</p>
                      <p className="text-sm font-semibold text-white">{data.metrics.totalHours}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">REG</p>
                      <p className="text-sm font-semibold text-blue-300">{data.metrics.straightHours}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">OVT</p>
                      <p className={`text-sm font-semibold ${data.metrics.overtimeHours > 100 ? 'text-orange-400' : 'text-white'}`}>
                        {data.metrics.overtimeHours}h
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Days</p>
                      <p className="text-sm font-semibold text-white">{data.metrics.totalDays}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Avg/Day</p>
                      <p className={`text-sm font-semibold ${data.metrics.avgHoursPerDay > 9 ? 'text-orange-400' : 'text-white'}`}>
                        {data.metrics.avgHoursPerDay}h
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Over 8h</p>
                      <p className="text-sm font-semibold text-red-400">{data.metrics.daysOver8}</p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </main>
  )
}
