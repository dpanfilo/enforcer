export const dynamic = 'force-dynamic'

import { fetchHoursData } from '@/lib/hoursData'
import { fetchFraudAnalysis } from '@/lib/fraudAnalysis'
import { fetchPermitWeekly } from '@/lib/permitData'
import { fetchUnsentJobs } from '@/lib/unsentJobs'
import { fetchTimeToPermit } from '@/lib/timeToPermit'
import MetricCard from './components/MetricCard'
import MonthlyChart from './components/MonthlyChart'
import TopJobsChart from './components/TopJobsChart'
import TimePatternChart from './components/TimePatternChart'
import DailyDistributionChart from './components/DailyDistributionChart'
import RecentActivity from './components/RecentActivity'
import FraudReport from './components/FraudReport'
import JobStatusChart from './components/JobStatusChart'
import PermitWeeklyChart from './components/PermitWeeklyChart'
import AdminCodeChart from './components/AdminCodeChart'
import WeeklyTrendChart from './components/WeeklyTrendChart'
import UnsentJobsTable from './components/UnsentJobsTable'
import TimeToPermitChart from './components/TimeToPermitChart'
import CalendarHeatmap from './components/CalendarHeatmap'
import PrintButton from './components/PrintButton'

export default async function Home() {
  const [
    hoursData,
    fraudReport,
    permitWeekly,
    unsentJobsData,
    timeToPermitData,
  ] = await Promise.all([
    fetchHoursData(),
    fetchFraudAnalysis(),
    fetchPermitWeekly(),
    fetchUnsentJobs(),
    fetchTimeToPermit(),
  ])

  const {
    metrics, monthly, topJobs, startHours, endHours,
    dailyDistribution, recentDays, statusBreakdown,
    adminBreakdown, weeklyTrend, calendarDays,
  } = hoursData

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
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Jovani Mendoza &middot; Time Dashboard
          </h1>
          {dateRange && (
            <p className="text-zinc-400 text-sm mt-1">{dateRange}</p>
          )}
        </div>
        <PrintButton />
      </div>

      {/* Metric Cards */}
      <div className="metric-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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

      {/* Activity Calendar — hidden in print (too wide for paper) */}
      <section style={{ backgroundColor: '#1a1d27' }} className="print:hidden rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Activity Calendar
        </h2>
        <CalendarHeatmap data={calendarDays} />
      </section>

      {/* Monthly Chart */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Monthly Hours — REG vs OVT
        </h2>
        <MonthlyChart data={monthly} />
      </section>

      {/* Weekly Trend */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Weekly Hours Trend — REG vs OVT
        </h2>
        <WeeklyTrendChart data={weeklyTrend} />
      </section>

      {/* Admin Code Breakdown */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Admin / Non-Billable Hours — {adminBreakdown.adminPct}% of Total
        </h2>
        <AdminCodeChart data={adminBreakdown} />
      </section>

      {/* Top Jobs + Daily Distribution */}
      <div className="print-stack grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Top 15 Jobs by Hours
          </h2>
          <p className="text-xs text-zinc-600 mb-4">Color = current job status · Hover for details</p>
          <TopJobsChart data={topJobs} />
        </section>

        <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            Daily Hours Distribution
          </h2>
          <DailyDistributionChart data={dailyDistribution} />
        </section>
      </div>

      {/* Hours by Job Status */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Hours by Job Status
        </h2>
        <p className="text-xs text-zinc-600 mb-4">Current status of each job worked on</p>
        <JobStatusChart data={statusBreakdown} />
      </section>

      {/* Permit Submissions per Week */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Jobs Sent to Permit — Weekly
        </h2>
        <PermitWeeklyChart data={permitWeekly} />
      </section>

      {/* Time to Permit */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Days from First Hours Entry to Permit Submission
        </h2>
        <p className="text-xs text-zinc-600 mb-4">
          How long after Jovani first logged hours on a job did JMendoza submit it to permit
        </p>
        <TimeToPermitChart data={timeToPermitData} />
      </section>

      {/* Jobs with hours but no permit */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Billable Jobs — No Permit Submission
        </h2>
        <p className="text-xs text-zinc-600 mb-4">
          Jobs where Jovani logged hours but JMendoza has no "To Permit" record in the system
        </p>
        <UnsentJobsTable data={unsentJobsData} />
      </section>

      {/* Start & End Time Patterns */}
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

      {/* Irregularity Analysis */}
      <section style={{ backgroundColor: '#1a1d27' }} className="rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Irregularity Analysis
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
