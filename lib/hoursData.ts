import { supabase } from './supabase'
import { fetchJobDetails, type JobDetail } from './jobEnrichment'

interface RawRow {
  date: string
  start: string | null
  end: string | null
  straight_code: string | null
  straight_hours: number | string | null
  premium_code: string | null
  premium_hours: number | string | null
  job: string | null
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
  description?: string
  city?: string
  state?: string
  status_name?: string
  macro_status?: string
  rush?: boolean
}

export interface StatusBreakdown {
  status: string
  macro_status: string
  hours: number
  jobCount: number
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
  straight: number
  overtime: number
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
  statusBreakdown: StatusBreakdown[]
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Safely coerce Supabase value (string or number) to a finite number */
function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isFinite(n) ? n : 0
}

/**
 * Normalize any date string to YYYY-MM-DD.
 * Handles: YYYY-MM-DD, M/D/YYYY, MM/DD/YYYY, M/D/YY, MM/DD/YY
 */
function normalizeDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slashMatch) {
    let [, m, d, y] = slashMatch
    if (y.length === 2) y = parseInt(y, 10) >= 50 ? `19${y}` : `20${y}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const dt = new Date(s)
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return s
}

/**
 * Parse a time string and return the hour (0–23).
 * Handles: HH:MM, HH:MM:SS, H:MM AM/PM, H:MM:SS AM/PM
 */
function parseHour(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.trim()

  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const period = ampm[3].toUpperCase()
    if (period === 'AM' && h === 12) h = 0
    if (period === 'PM' && h !== 12) h += 12
    return isFinite(h) ? h : null
  }

  const h24 = s.match(/^(\d{1,2}):/)
  if (h24) {
    const h = parseInt(h24[1], 10)
    return isFinite(h) && h >= 0 && h <= 23 ? h : null
  }

  return null
}

/**
 * Return the ISO date string (YYYY-MM-DD) of the Monday that starts
 * the week containing `date` (weeks run Mon–Sun).
 */
function getMondayOfWeek(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const dow = d.getDay() // 0=Sun … 6=Sat
  const daysSinceMonday = (dow + 6) % 7 // Mon=0, Tue=1, … Sun=6
  d.setDate(d.getDate() - daysSinceMonday)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export async function fetchHoursData(): Promise<HoursData> {
  const allRows: RawRow[] = []

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

  // --- Normalize dates and group rows by date ---
  const byDate = new Map<string, RawRow[]>()
  for (const row of allRows) {
    const normDate = normalizeDate(row.date)
    if (!normDate) continue
    const existing = byDate.get(normDate) ?? []
    existing.push(row)
    byDate.set(normDate, existing)
  }

  // --- Step 1: total hours worked per day (DB straight + premium = all hours) ---
  const dailyTotalHours = new Map<string, number>()
  for (const [date, rows] of byDate.entries()) {
    const total = rows.reduce(
      (s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours),
      0
    )
    dailyTotalHours.set(date, total)
  }

  // --- Step 2: group dates into Mon–Sun weeks ---
  const weekMap = new Map<string, string[]>() // mondayKey -> dates[]
  for (const date of dailyTotalHours.keys()) {
    const weekKey = getMondayOfWeek(date)
    const existing = weekMap.get(weekKey) ?? []
    existing.push(date)
    weekMap.set(weekKey, existing)
  }

  // --- Step 3: compute daily straight/overtime via 40h weekly threshold ---
  const dailyStraight = new Map<string, number>()
  const dailyOvertime = new Map<string, number>()

  for (const dates of weekMap.values()) {
    // Process days in chronological order within the week
    const sorted = [...dates].sort()
    let weeklyAccum = 0

    for (const date of sorted) {
      const dayHours = dailyTotalHours.get(date) ?? 0
      const regularBudget = Math.max(0, 40 - weeklyAccum)
      const dayStr = Math.min(dayHours, regularBudget)
      const dayOvt = Math.max(0, dayHours - regularBudget)
      dailyStraight.set(date, dayStr)
      dailyOvertime.set(date, dayOvt)
      weeklyAccum += dayHours
    }
  }

  // --- Step 4: aggregate metrics using recalculated straight/overtime ---
  let totalHours = 0
  let straightHours = 0
  let overtimeHours = 0
  let daysOver8 = 0
  let weekendDays = 0

  const monthlyMap = new Map<string, { straight: number; overtime: number; days: Set<string> }>()
  const jobMap = new Map<string, number>()
  const startHourMap = new Map<number, number>()
  const endHourMap = new Map<number, number>()

  for (const [date, rows] of byDate.entries()) {
    const dayTotal = dailyTotalHours.get(date) ?? 0
    const dayStr = dailyStraight.get(date) ?? 0
    const dayOvt = dailyOvertime.get(date) ?? 0

    totalHours += dayTotal
    straightHours += dayStr
    overtimeHours += dayOvt

    const d = new Date(date + 'T00:00:00')
    const dow = d.getDay()
    if (dow === 0 || dow === 6) weekendDays++
    if (dayTotal > 8) daysOver8++

    // Monthly
    const monthKey = date.slice(0, 7)
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { straight: 0, overtime: 0, days: new Set() })
    }
    const mo = monthlyMap.get(monthKey)!
    mo.straight += dayStr
    mo.overtime += dayOvt
    mo.days.add(date)

    // Job hours (total worked, not split)
    for (const row of rows) {
      if (row.job) {
        const rowTotal = toNum(row.straight_hours) + toNum(row.premium_hours)
        jobMap.set(row.job, (jobMap.get(row.job) ?? 0) + rowTotal)
      }
    }

    // Start/end hours for pattern charts
    const sortedByStart = [...rows].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
    const sortedByEnd = [...rows].sort((a, b) => (a.end ?? '').localeCompare(b.end ?? ''))

    const startHour = parseHour(sortedByStart[0]?.start)
    const endHour = parseHour(sortedByEnd[sortedByEnd.length - 1]?.end)

    if (startHour !== null) startHourMap.set(startHour, (startHourMap.get(startHour) ?? 0) + 1)
    if (endHour !== null) endHourMap.set(endHour, (endHourMap.get(endHour) ?? 0) + 1)
  }

  const totalDays = byDate.size
  const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0

  // --- Monthly array ---
  const monthly: MonthlyData[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      straight: Math.round(v.straight * 100) / 100,
      overtime: Math.round(v.overtime * 100) / 100,
      days: v.days.size,
    }))

  // --- All jobs sorted by hours ---
  const allJobsSorted = Array.from(jobMap.entries()).sort(([, a], [, b]) => b - a)

  // --- Enrich with job details from jobs + statuses tables ---
  const uniqueJobCodes = allJobsSorted.map(([job]) => job).filter(Boolean)
  const jobDetails: Map<string, JobDetail> = await fetchJobDetails(uniqueJobCodes)

  // --- Top 15 jobs (enriched) ---
  const topJobs: JobData[] = allJobsSorted.slice(0, 15).map(([job, hours]) => {
    const detail = jobDetails.get(job)
    return {
      job,
      hours: Math.round(hours * 100) / 100,
      description: detail?.description,
      city: detail?.city,
      state: detail?.state,
      status_name: detail?.status_name,
      macro_status: detail?.macro_status,
      rush: detail?.rush,
    }
  })

  // --- Hours by current job status ---
  const statusHoursMap = new Map<string, { macro_status: string; hours: number; jobs: Set<string> }>()
  for (const [job, hours] of allJobsSorted) {
    const detail = jobDetails.get(job)
    const statusKey = detail?.status_name ?? 'Unknown'
    const macroKey = detail?.macro_status ?? ''
    if (!statusHoursMap.has(statusKey)) {
      statusHoursMap.set(statusKey, { macro_status: macroKey, hours: 0, jobs: new Set() })
    }
    const entry = statusHoursMap.get(statusKey)!
    entry.hours += hours
    entry.jobs.add(job)
  }
  const statusBreakdown: StatusBreakdown[] = Array.from(statusHoursMap.entries())
    .map(([status, v]) => ({
      status,
      macro_status: v.macro_status,
      hours: Math.round(v.hours * 100) / 100,
      jobCount: v.jobs.size,
    }))
    .sort((a, b) => b.hours - a.hours)

  // --- Start/end hour arrays ---
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
  for (const hrs of dailyTotalHours.values()) {
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
  const last30 = sortedDates.slice(-30)
  const recentDays: RecentDay[] = last30.map((date) => {
    const rows = byDate.get(date)!
    const d = new Date(date + 'T00:00:00')
    const dayOfWeek = DAY_NAMES[d.getDay()] ?? ''
    const hours = dailyTotalHours.get(date) ?? 0
    const straight = dailyStraight.get(date) ?? 0
    const overtime = dailyOvertime.get(date) ?? 0
    const jobs = [...new Set(rows.map((r) => r.job).filter((j): j is string => !!j))]
    return {
      date,
      dayOfWeek,
      hours: Math.round(hours * 100) / 100,
      straight: Math.round(straight * 100) / 100,
      overtime: Math.round(overtime * 100) / 100,
      jobs,
    }
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
    statusBreakdown,
  }
}
