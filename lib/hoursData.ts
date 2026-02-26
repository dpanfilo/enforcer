import { supabase } from './supabase'

interface RawRow {
  date: string
  start: string
  end: string
  straight_code: string
  straight_hours: number
  premium_code: string | null
  premium_hours: number | null
  job: string
  notes: string | null
}

export interface Metrics {
  totalHours: number
  straightHours: number
  overtimeHours: number
  totalDays: number
  avgHoursPerDay: number
  daysOver8: number
  weekendDays: number
}

export interface MonthlyData {
  month: string
  straight: number
  overtime: number
  days: number
}

export interface JobData {
  job: string
  hours: number
}

export interface HourCount {
  hour: number
  count: number
}

export interface BucketData {
  bucket: string
  count: number
}

export interface RecentDay {
  date: string
  dayOfWeek: string
  hours: number
  jobs: string[]
}

export interface HoursData {
  metrics: Metrics
  monthly: MonthlyData[]
  topJobs: JobData[]
  startHours: HourCount[]
  endHours: HourCount[]
  dailyDistribution: BucketData[]
  recentDays: RecentDay[]
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function fetchHoursData(): Promise<HoursData> {
  const allRows: RawRow[] = []

  // Fetch all pages (1000 records each)
  for (let offset = 0; offset < 4000; offset += 1000) {
    const { data, error } = await supabase
      .from('hours_import')
      .select('date,start,end,straight_code,straight_hours,premium_code,premium_hours,job,notes')
      .eq('employee_name', 'Jovani Mendoza')
      .range(offset, offset + 999)

    if (error) throw new Error(`Supabase fetch error at offset ${offset}: ${error.message}`)
    if (!data || data.length === 0) break
    allRows.push(...(data as RawRow[]))
    if (data.length < 1000) break
  }

  // Group rows by date
  const byDate = new Map<string, RawRow[]>()
  for (const row of allRows) {
    const existing = byDate.get(row.date) ?? []
    existing.push(row)
    byDate.set(row.date, existing)
  }

  // --- Metrics ---
  let totalHours = 0
  let straightHours = 0
  let overtimeHours = 0
  let daysOver8 = 0
  let weekendDays = 0

  const dailyHours = new Map<string, number>()
  const monthlyMap = new Map<string, { straight: number; overtime: number; days: Set<string> }>()
  const jobMap = new Map<string, number>()
  const startHourMap = new Map<number, number>()
  const endHourMap = new Map<number, number>()

  for (const [date, rows] of byDate.entries()) {
    const d = new Date(date + 'T00:00:00')
    const dow = d.getDay() // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6
    if (isWeekend) weekendDays++

    let dayTotal = 0
    let dayStr = 0
    let dayOvt = 0

    for (const row of rows) {
      const sh = row.straight_hours ?? 0
      const ph = row.premium_hours ?? 0
      dayStr += sh
      dayOvt += ph
      dayTotal += sh + ph

      // Job hours
      if (row.job) {
        jobMap.set(row.job, (jobMap.get(row.job) ?? 0) + sh + ph)
      }
    }

    totalHours += dayTotal
    straightHours += dayStr
    overtimeHours += dayOvt
    dailyHours.set(date, dayTotal)
    if (dayTotal > 8) daysOver8++

    // Monthly
    const monthKey = date.slice(0, 7) // YYYY-MM
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { straight: 0, overtime: 0, days: new Set() })
    }
    const m = monthlyMap.get(monthKey)!
    m.straight += dayStr
    m.overtime += dayOvt
    m.days.add(date)

    // Start/end hours — first start and last end of the day
    const sortedByStart = [...rows].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
    const sortedByEnd = [...rows].sort((a, b) => (a.end ?? '').localeCompare(b.end ?? ''))

    const firstStart = sortedByStart[0]?.start
    const lastEnd = sortedByEnd[sortedByEnd.length - 1]?.end

    if (firstStart) {
      const hour = parseInt(firstStart.slice(0, 2), 10)
      if (!isNaN(hour)) startHourMap.set(hour, (startHourMap.get(hour) ?? 0) + 1)
    }
    if (lastEnd) {
      const hour = parseInt(lastEnd.slice(0, 2), 10)
      if (!isNaN(hour)) endHourMap.set(hour, (endHourMap.get(hour) ?? 0) + 1)
    }
  }

  const totalDays = byDate.size
  const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0

  // --- Monthly array (sorted) ---
  const monthly: MonthlyData[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      straight: Math.round(v.straight * 100) / 100,
      overtime: Math.round(v.overtime * 100) / 100,
      days: v.days.size,
    }))

  // --- Top 15 jobs ---
  const topJobs: JobData[] = Array.from(jobMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([job, hours]) => ({ job, hours: Math.round(hours * 100) / 100 }))

  // --- Start/end hour arrays (fill gaps 0–23) ---
  const startHours: HourCount[] = []
  const endHours: HourCount[] = []
  for (let h = 0; h <= 23; h++) {
    const sc = startHourMap.get(h) ?? 0
    const ec = endHourMap.get(h) ?? 0
    if (sc > 0) startHours.push({ hour: h, count: sc })
    if (ec > 0) endHours.push({ hour: h, count: ec })
  }

  // --- Daily distribution buckets ---
  const buckets: Record<string, number> = {
    '0–4h': 0,
    '4–6h': 0,
    '6–8h': 0,
    '8–10h': 0,
    '10–12h': 0,
    '12h+': 0,
  }
  for (const hrs of dailyHours.values()) {
    if (hrs < 4) buckets['0–4h']++
    else if (hrs < 6) buckets['4–6h']++
    else if (hrs < 8) buckets['6–8h']++
    else if (hrs < 10) buckets['8–10h']++
    else if (hrs < 12) buckets['10–12h']++
    else buckets['12h+']++
  }
  const dailyDistribution: BucketData[] = Object.entries(buckets).map(([bucket, count]) => ({
    bucket,
    count,
  }))

  // --- Recent 30 days ---
  const sortedDates = Array.from(byDate.keys()).sort()
  const last30Dates = sortedDates.slice(-30)
  const recentDays: RecentDay[] = last30Dates.map((date) => {
    const rows = byDate.get(date)!
    const d = new Date(date + 'T00:00:00')
    const dayOfWeek = DAY_NAMES[d.getDay()]
    const hours = rows.reduce((s, r) => s + (r.straight_hours ?? 0) + (r.premium_hours ?? 0), 0)
    const jobs = [...new Set(rows.map((r) => r.job).filter(Boolean))]
    return { date, dayOfWeek, hours: Math.round(hours * 100) / 100, jobs }
  })

  return {
    metrics: {
      totalHours: Math.round(totalHours * 100) / 100,
      straightHours: Math.round(straightHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      totalDays,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      daysOver8,
      weekendDays,
    },
    monthly,
    topJobs,
    startHours,
    endHours,
    dailyDistribution,
    recentDays,
  }
}
