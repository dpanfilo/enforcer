import { fetchHoursData } from '@/lib/hoursData'
import { fetchFraudAnalysis } from '@/lib/fraudAnalysis'
import MetricCard from './components/MetricCard'
import MonthlyChart from './components/MonthlyChart'
import TopJobsChart from './components/TopJobsChart'
import TimePatternChart from './components/TimePatternChart'
import DailyDistributionChart from './components/DailyDistributionChart'
import RecentActivity from './components/RecentActivity'
import FraudReport from './components/FraudReport'

export default async function Home() {
  const [
    { metrics, monthly, topJobs, startHours, endHours, dailyDistribution, recentDays },
    fraudReport,
  ] = await Promise.all([fetchHoursData(), fetchFraudAnalysis()])

  // Determine date range from monthly data
  const firstMonth = monthly[0]?.month ?? ''
  const lastMonth = monthly[monthly.length - 1]?.month ?? ''
  const formatMonth = (ym: string) => {
    if (!ym) return ''
    const [y, m] = ym.split('-')
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${names[parseInt(m, 10) - 1]} ${y}`
  }
  const dateRange = firstMonth && lastMonth ? `${formatMonth(firstMonth)} – ${formatMonth(lastMonth)}` : ''

  return (
    <main
      className="min-h-screen p-6 md:p-10 font-sans"
      style={{ backgroundColor: '#0f1117', color: '#e5e7eb' }}
    >
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          Jovani Mendoza &middot; Time Dashboard
        </h1>
        {dateRange && (
          <p className="text-zinc-400 text-sm mt-1">{dateRange}</p>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <MetricCard label="Total Hours" value={`${metrics.totalHours}h`} />
        <MetricCard label="Regular (REG)" value={`${metrics.straightHours}h`} />
        <MetricCard
          label="Overtime (OVT)"
          value={`${metrics.overtimeHours}h`}
          highlight={metrics.overtimeHours > 500}
        />
        <MetricCard label="Work Days" value={metrics.totalDays} />
        <MetricCard
          label="Avg / Day"
          value={`${metrics.avgHoursPerDay}h`}
          highlight={metrics.avgHoursPerDay > 9}
        />
        <MetricCard
          label="Days Over 8h"
          value={metrics.daysOver8}
          sub={`${metrics.weekendDays} weekend days`}
          highlight={true}
        />
      </div>

      {/* Monthly Chart */}
      <section
        style={{ backgroundColor: '#1a1d27' }}
        className="rounded-xl p-6 mb-6"
      >
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Monthly Hours — REG vs OVT
        </h2>
        <MonthlyChart data={monthly} />
      </section>

      {/* Top Jobs + Daily Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Top 15 Jobs by Hours
          </h2>
          <TopJobsChart data={topJobs} />
        </section>

        <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Daily Hours Distribution
          </h2>
          <DailyDistributionChart data={dailyDistribution} />
        </section>
      </div>

      {/* Time Pattern Charts */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Start &amp; End Time Patterns
        </h2>
        <TimePatternChart startHours={startHours} endHours={endHours} />
      </section>

      {/* Recent Activity */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Recent 30 Days
        </h2>
        <RecentActivity data={recentDays} />
      </section>

      {/* Fraud / Irregularity Report */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Irregularity &amp; Fraud Analysis
          </h2>
          {fraudReport.summary.high > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
              {fraudReport.summary.high} HIGH RISK
            </span>
          )}
        </div>
        <FraudReport report={fraudReport} />
      </section>
    </main>
  )
}
