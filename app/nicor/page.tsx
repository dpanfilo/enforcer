export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { nameToSlug } from '@/lib/employees'
import { fetchHoursData } from '@/lib/hoursData'
import { fetchDraftingMisc } from '@/lib/draftingMisc'
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
  const [draftingMisc, results] = await Promise.all([
    fetchDraftingMisc(NICOR_TEAM),
    Promise.all(
      NICOR_TEAM.map(async (name) => {
        try {
          const data = await fetchHoursData(name)
          return { name, data, error: null }
        } catch {
          return { name, data: null, error: 'No data found' }
        }
      })
    ),
  ])

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

      {/* Drafting vs Miscellaneous breakdown */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Drafting vs Miscellaneous — NCP Jobs
        </h2>
        <p className="text-xs text-zinc-500 mb-6">
          Drafting = hours on NCP job codes · Miscellaneous = admin/non-billable hours · Averages per unique NCP job
        </p>

        {/* Team summary chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="rounded-lg px-4 py-3 bg-blue-900/30 border border-blue-700/40">
            <p className="text-blue-300 font-bold text-xl">{draftingMisc.totalDrafting}h</p>
            <p className="text-blue-400 text-xs mt-0.5">Total Drafting</p>
          </div>
          <div className="rounded-lg px-4 py-3 bg-amber-900/30 border border-amber-700/40">
            <p className="text-amber-300 font-bold text-xl">{draftingMisc.totalMisc}h</p>
            <p className="text-amber-400 text-xs mt-0.5">Total Miscellaneous</p>
          </div>
          <div className="rounded-lg px-4 py-3 bg-zinc-800 border border-zinc-600">
            <p className="text-white font-bold text-xl">{draftingMisc.uniqueNcpJobs}</p>
            <p className="text-zinc-400 text-xs mt-0.5">Unique NCP Jobs</p>
          </div>
          <div className="rounded-lg px-4 py-3 bg-blue-900/20 border border-blue-700/30">
            <p className="text-blue-300 font-bold text-xl">{draftingMisc.avgDraftingPerJob}h</p>
            <p className="text-blue-400 text-xs mt-0.5">Avg Drafting / Job</p>
          </div>
          <div className="rounded-lg px-4 py-3 bg-amber-900/20 border border-amber-700/30">
            <p className="text-amber-300 font-bold text-xl">{draftingMisc.avgMiscPerJob}h</p>
            <p className="text-amber-400 text-xs mt-0.5">Avg Misc / Job</p>
          </div>
          <div className="rounded-lg px-4 py-3 bg-zinc-800 border border-zinc-600">
            <p className="text-white font-bold text-xl">{draftingMisc.miscRatio}%</p>
            <p className="text-zinc-400 text-xs mt-0.5">Misc of Total</p>
          </div>
        </div>

        {/* Rule of thumb */}
        <div className="rounded-lg px-4 py-3 mb-6 border border-emerald-700/40" style={{ backgroundColor: '#0d2018' }}>
          <p className="text-emerald-300 text-sm font-medium">
            Rule of thumb: for every <strong>1h</strong> of drafting, add{' '}
            <strong>{draftingMisc.miscPerDraftingHour}h</strong> miscellaneous
            &nbsp;·&nbsp; or <strong>{draftingMisc.avgMiscPerJob}h misc</strong> per NCP job invoiced
          </p>
        </div>

        {/* Per-employee table */}
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 text-left border-b border-zinc-700">
              <th className="pb-2 font-medium">Employee</th>
              <th className="pb-2 font-medium text-blue-400">Drafting (h)</th>
              <th className="pb-2 font-medium text-amber-400">Misc (h)</th>
              <th className="pb-2 font-medium">NCP Jobs</th>
              <th className="pb-2 font-medium text-blue-400">Avg Draft/Job</th>
              <th className="pb-2 font-medium text-amber-400">Avg Misc/Job</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {draftingMisc.employees.map((e) => (
              <tr key={e.name} className="hover:bg-zinc-800/40">
                <td className="py-2 pr-4 text-white font-medium">{e.name}</td>
                <td className="py-2 pr-4 text-blue-300 font-semibold">{e.draftingHours}h</td>
                <td className="py-2 pr-4 text-amber-300 font-semibold">{e.miscHours}h</td>
                <td className="py-2 pr-4 text-zinc-300">{e.ncpJobCount}</td>
                <td className="py-2 pr-4 text-blue-300">{e.avgDraftingPerJob}h</td>
                <td className="py-2 text-amber-300">{e.avgMiscPerJob}h</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {(() => {
              const active = draftingMisc.employees.filter((e) => e.ncpJobCount > 0)
              if (!active.length) return null
              const avgOfAvgDraft = Math.round((active.reduce((s, e) => s + e.avgDraftingPerJob, 0) / active.length) * 100) / 100
              const avgOfAvgMisc  = Math.round((active.reduce((s, e) => s + e.avgMiscPerJob,     0) / active.length) * 100) / 100
              return (
                <tr className="border-t-2 border-zinc-600" style={{ backgroundColor: '#0f1117' }}>
                  <td className="pt-3 pb-2 pr-4 text-zinc-400 font-semibold text-xs uppercase tracking-wide">
                    Avg of Averages
                  </td>
                  <td className="pt-3 pb-2 pr-4 text-zinc-500">—</td>
                  <td className="pt-3 pb-2 pr-4 text-zinc-500">—</td>
                  <td className="pt-3 pb-2 pr-4 text-zinc-500">—</td>
                  <td className="pt-3 pb-2 pr-4 text-blue-200 font-bold text-sm">{avgOfAvgDraft}h</td>
                  <td className="pt-3 pb-2 text-amber-200 font-bold text-sm">{avgOfAvgMisc}h</td>
                </tr>
              )
            })()}
          </tfoot>
        </table>

        {/* Period breakdown tables */}
        {(['quarterly', 'monthly'] as const).map((mode) => {
          const rows = draftingMisc[mode]
          const avgDraft = rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.avgDraftingPerJob, 0) / rows.length) * 100) / 100 : 0
          const avgMisc  = rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.avgMiscPerJob,     0) / rows.length) * 100) / 100 : 0
          return (
            <div key={mode} className="mt-6">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                {mode === 'quarterly' ? 'By Quarter' : 'By Month'}
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-400 text-left border-b border-zinc-700">
                    <th className="pb-2 font-medium">Period</th>
                    <th className="pb-2 font-medium text-blue-400">Drafting (h)</th>
                    <th className="pb-2 font-medium text-amber-400">Misc (h)</th>
                    <th className="pb-2 font-medium">NCP Jobs</th>
                    <th className="pb-2 font-medium text-blue-400">Avg Draft/Job</th>
                    <th className="pb-2 font-medium text-amber-400">Avg Misc/Job</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((r) => (
                    <tr key={r.period} className="hover:bg-zinc-800/40">
                      <td className="py-2 pr-4 text-white font-medium">{r.period}</td>
                      <td className="py-2 pr-4 text-blue-300 font-semibold">{r.draftingHours}h</td>
                      <td className="py-2 pr-4 text-amber-300 font-semibold">{r.miscHours}h</td>
                      <td className="py-2 pr-4 text-zinc-300">{r.ncpJobCount}</td>
                      <td className="py-2 pr-4 text-blue-300">{r.avgDraftingPerJob}h</td>
                      <td className="py-2 text-amber-300">{r.avgMiscPerJob}h</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-600" style={{ backgroundColor: '#0f1117' }}>
                    <td className="pt-3 pb-2 pr-4 text-zinc-400 font-semibold text-xs uppercase tracking-wide">Avg of Averages</td>
                    <td className="pt-3 pb-2 pr-4 text-zinc-500">—</td>
                    <td className="pt-3 pb-2 pr-4 text-zinc-500">—</td>
                    <td className="pt-3 pb-2 pr-4 text-zinc-500">—</td>
                    <td className="pt-3 pb-2 pr-4 text-blue-200 font-bold text-sm">{avgDraft}h</td>
                    <td className="pt-3 pb-2 text-amber-200 font-bold text-sm">{avgMisc}h</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })}
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
