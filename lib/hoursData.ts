import { supabase } from './supabase'

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

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // M/D/YYYY or MM/DD/YYYY or M/D/YY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slashMatch) {
    let [, m, d, y] = slashMatch
    if (y.length === 2) y = parseInt(y, 10) >= 50 ? `19${y}` : `20${y}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Fallback: try to parse with Date and re-format
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return s // return as-is if nothing worked
}

/**
 * Parse a time string and return the hour (0–23).
 * Handles: HH:MM, HH:MM:SS, H:MM AM/PM, H:MM:SS AM/PM
 */
function parseHour(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.trim()

  // Try "H:MM AM" or "H:MM PM" (12-hour)
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const period = ampm[3].toUpperCase()
    if (period === 'AM' && h === 12) h = 0
    if (period === 'PM' && h !== 12) h += 12
    return isFinite(h) ? h : null
  }

  // Try "HH:MM" or "HH:MM:SS" (24-hour)
  const h24 = s.match(/^(\d{1,2}):/)
  if (h24) {
    const h = parseInt(h24[1], 10)
    return isFinite(h) && h >= 0 && h <= 23 ? h : null
  }

  return null
}

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

  // Normalize dates and group rows by normalized date
  const byDate = new Map<string, RawRow[]>()
  for (const row of allRows) {
    const normDate = normalizeDate(row.date)
    if (!normDate) continue
    const existing = byDate.get(normDate) ?? []
    existing.push(row)
    byDate.set(normDate, existing)
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
    if (dow === 0 || dow === 6) weekendDays++

    let dayTotal = 0
    let dayStr = 0
    let dayOvt = 0

    for (const row of rows) {
      const sh = toNum(row.straight_hours)
      const ph = toNum(row.premium_hours)
      dayStr += sh
      dayOvt += ph
      dayTotal += sh + ph

      if (row.job) {
        jobMap.set(row.job, (jobMap.get(row.job) ?? 0) + sh + ph)
      }
    }

    totalHours += dayTotal
    straightHours += dayStr
    overtimeHours += dayOvt
    dailyHours.set(date, dayTotal)
    if (dayTotal > 8) daysOver8++

    // Monthly key from normalized YYYY-MM-DD
    const monthKey = date.slice(0, 7) // always YYYY-MM after normalization
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { straight: 0, overtime: 0, days: new Set() })
    }
    const mo = monthlyMap.get(monthKey)!
    mo.straight += dayStr
    mo.overtime += dayOvt
    mo.days.add(date)

    // Start/end hour of each day
    const sortedByStart = [...rows].sort((a, b) =>
      (a.start ?? '').localeCompare(b.start ?? '')
    )
    const sortedByEnd = [...rows].sort((a, b) =>
      (a.end ?? '').localeCompare(b.end ?? '')
    )

    const startHour = parseHour(sortedByStart[0]?.start)
    const endHour = parseHour(sortedByEnd[sortedByEnd.length - 1]?.end)

    if (startHour !== null) startHourMap.set(startHour, (startHourMap.get(startHour) ?? 0) + 1)
    if (endHour !== null) endHourMap.set(endHour, (endHourMap.get(endHour) ?? 0) + 1)
  }

  const totalDays = byDate.size
  const avgHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0

  // --- Monthly array (sorted chronologically) ---
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

  // --- Recent 30 days (sorted, last 30) ---
  const sortedDates = Array.from(byDate.keys()).sort()
  const last30 = sortedDates.slice(-30)
  const recentDays: RecentDay[] = last30.map((date) => {
    const rows = byDate.get(date)!
    const d = new Date(date + 'T00:00:00')
    const dayOfWeek = DAY_NAMES[d.getDay()] ?? ''
    const hours = rows.reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0)
    const jobs = [...new Set(rows.map((r) => r.job).filter((j): j is string => !!j))]
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
