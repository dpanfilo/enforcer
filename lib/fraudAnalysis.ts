import { supabase } from './supabase'

interface RawRow {
  date: string
  start: string | null
  end: string | null
  straight_hours: number | string | null
  premium_hours: number | string | null
  job: string | null
  notes: string | null
}

export type FlagSeverity = 'high' | 'medium' | 'low'

export interface Flag {
  severity: FlagSeverity
  category: string
  date: string
  detail: string
}

export interface FraudReport {
  flags: Flag[]
  summary: {
    high: number
    medium: number
    low: number
    weekendDays: number
    longestStreak: number
    duplicates: number
    mismatches: number
    overlaps: number
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isFinite(n) ? n : 0
}

function normalizeDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slash) {
    let [, m, d, y] = slash
    if (y.length === 2) y = parseInt(y, 10) >= 50 ? `19${y}` : `20${y}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dt = new Date(s)
  if (!isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  return s
}

/** Returns minutes since midnight, or null if unparseable */
function timeToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.trim()

  // H:MM AM/PM
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const min = parseInt(ampm[2], 10)
    const period = ampm[3].toUpperCase()
    if (period === 'AM' && h === 12) h = 0
    if (period === 'PM' && h !== 12) h += 12
    return isFinite(h) && isFinite(min) ? h * 60 + min : null
  }

  // HH:MM or HH:MM:SS (24-hour)
  const h24 = s.match(/^(\d{1,2}):(\d{2})/)
  if (h24) {
    const h = parseInt(h24[1], 10)
    const min = parseInt(h24[2], 10)
    return isFinite(h) && isFinite(min) ? h * 60 + min : null
  }

  return null
}

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, '0')}`
}

// ── main ───────────────────────────────────────────────────────────────────

export async function fetchFraudAnalysis(): Promise<FraudReport> {
  const allRows: RawRow[] = []

  for (let offset = 0; offset < 4000; offset += 1000) {
    const { data, error } = await supabase
      .from('hours_import')
      .select('date,start,end,straight_hours,premium_hours,job,notes')
      .eq('employee_name', 'Jovani Mendoza')
      .range(offset, offset + 999)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    allRows.push(...(data as RawRow[]))
    if (data.length < 1000) break
  }

  // Normalize dates on every row
  const rows = allRows.map((r) => ({ ...r, date: normalizeDate(r.date) })).filter((r) => r.date)

  // Group by date
  const byDate = new Map<string, RawRow[]>()
  for (const row of rows) {
    const arr = byDate.get(row.date) ?? []
    arr.push(row)
    byDate.set(row.date, arr)
  }

  const flags: Flag[] = []
  const TODAY = '2026-02-25'

  // ── 1. Future-dated entries ──────────────────────────────────────────────
  for (const date of byDate.keys()) {
    if (date > TODAY) {
      flags.push({
        severity: 'high',
        category: 'Future Date',
        date,
        detail: `Entry dated ${date} is in the future (today is ${TODAY}).`,
      })
    }
  }

  // ── 2. Duplicate entries (same date + start + end + job) ────────────────
  let duplicates = 0
  for (const [date, dayRows] of byDate.entries()) {
    const seen = new Set<string>()
    for (const r of dayRows) {
      const key = `${r.start}|${r.end}|${r.job}`
      if (seen.has(key)) {
        duplicates++
        flags.push({
          severity: 'high',
          category: 'Duplicate Entry',
          date,
          detail: `Duplicate row: start=${r.start} end=${r.end} job=${r.job ?? '—'}`,
        })
      }
      seen.add(key)
    }
  }

  // ── 3. Overlapping time entries on the same day ──────────────────────────
  let overlaps = 0
  for (const [date, dayRows] of byDate.entries()) {
    // Build intervals with valid start/end minutes
    const intervals: { startMin: number; endMin: number; job: string | null; start: string; end: string }[] = []
    for (const r of dayRows) {
      const s = timeToMinutes(r.start)
      const e = timeToMinutes(r.end)
      if (s !== null && e !== null && e > s) {
        intervals.push({ startMin: s, endMin: e, job: r.job, start: r.start!, end: r.end! })
      }
    }
    // Check all pairs
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i], b = intervals[j]
        const overlapStart = Math.max(a.startMin, b.startMin)
        const overlapEnd = Math.min(a.endMin, b.endMin)
        if (overlapEnd > overlapStart) {
          overlaps++
          const mins = overlapEnd - overlapStart
          flags.push({
            severity: 'high',
            category: 'Overlapping Entries',
            date,
            detail: `${a.start}–${a.end} (${a.job ?? '—'}) overlaps ${b.start}–${b.end} (${b.job ?? '—'}) by ${mins} min.`,
          })
        }
      }
    }
  }

  // ── 4. Hours mismatch: reported hours vs. clock-in/clock-out ─────────────
  let mismatches = 0
  const MISMATCH_TOLERANCE_HRS = 0.26 // ~15 min
  for (const [date, dayRows] of byDate.entries()) {
    for (const r of dayRows) {
      const s = timeToMinutes(r.start)
      const e = timeToMinutes(r.end)
      if (s === null || e === null) continue
      if (e <= s) continue // overnight or bad data, skip
      const clockHours = (e - s) / 60
      const reportedHours = toNum(r.straight_hours) + toNum(r.premium_hours)
      if (reportedHours === 0) continue
      const diff = Math.abs(clockHours - reportedHours)
      if (diff > MISMATCH_TOLERANCE_HRS) {
        mismatches++
        flags.push({
          severity: diff > 1 ? 'high' : 'medium',
          category: 'Hours Mismatch',
          date,
          detail: `${r.start}–${r.end} = ${clockHours.toFixed(2)}h on clock, but ${reportedHours}h reported (diff ${diff.toFixed(2)}h). Job: ${r.job ?? '—'}`,
        })
      }
    }
  }

  // ── 5. Extremely long days (>14h total) ──────────────────────────────────
  for (const [date, dayRows] of byDate.entries()) {
    const total = dayRows.reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0)
    if (total > 14) {
      flags.push({
        severity: 'medium',
        category: 'Extremely Long Day',
        date,
        detail: `${total.toFixed(2)}h reported in a single day.`,
      })
    }
  }

  // ── 6. Very early start (<5:00 AM) or very late end (≥23:00) ────────────
  for (const [date, dayRows] of byDate.entries()) {
    for (const r of dayRows) {
      const s = timeToMinutes(r.start)
      const e = timeToMinutes(r.end)
      if (s !== null && s < 5 * 60) {
        flags.push({
          severity: 'low',
          category: 'Unusual Hours',
          date,
          detail: `Start time ${r.start} is before 5:00 AM. Job: ${r.job ?? '—'}`,
        })
      }
      if (e !== null && e >= 23 * 60) {
        flags.push({
          severity: 'low',
          category: 'Unusual Hours',
          date,
          detail: `End time ${r.end} is at or after 11:00 PM. Job: ${r.job ?? '—'}`,
        })
      }
    }
  }

  // ── 7. Weekend work ──────────────────────────────────────────────────────
  let weekendDays = 0
  for (const date of byDate.keys()) {
    const dow = new Date(date + 'T00:00:00').getDay()
    if (dow === 0 || dow === 6) {
      weekendDays++
      const dayRows = byDate.get(date)!
      const total = dayRows.reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0)
      const dayName = dow === 0 ? 'Sunday' : 'Saturday'
      flags.push({
        severity: 'low',
        category: 'Weekend Work',
        date,
        detail: `Worked ${total.toFixed(2)}h on a ${dayName}.`,
      })
    }
  }

  // ── 8. Consecutive work streaks >10 days ────────────────────────────────
  const sortedDates = Array.from(byDate.keys()).sort()
  let streak = 1
  let longestStreak = 1
  let streakStart = sortedDates[0] ?? ''

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00')
    const curr = new Date(sortedDates[i] + 'T00:00:00')
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000)
    if (diffDays === 1) {
      streak++
      if (streak > longestStreak) longestStreak = streak
      if (streak > 10) {
        flags.push({
          severity: 'medium',
          category: 'Long Work Streak',
          date: sortedDates[i],
          detail: `Day ${streak} of consecutive work starting ${streakStart}. No day off in ${streak} days.`,
        })
      }
    } else {
      streak = 1
      streakStart = sortedDates[i]
    }
  }

  // ── 9. Suspiciously identical daily totals (same hours ≥5 days in a row) ─
  const dailyTotals = sortedDates.map((d) => ({
    date: d,
    total: byDate.get(d)!.reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0),
  }))

  let sameStreak = 1
  for (let i = 1; i < dailyTotals.length; i++) {
    const same = Math.abs(dailyTotals[i].total - dailyTotals[i - 1].total) < 0.01
    if (same) {
      sameStreak++
      if (sameStreak >= 5) {
        flags.push({
          severity: 'low',
          category: 'Identical Daily Hours',
          date: dailyTotals[i].date,
          detail: `Exactly ${dailyTotals[i].total}h reported for ${sameStreak} consecutive days (since ${dailyTotals[i - sameStreak + 1].date}).`,
        })
      }
    } else {
      sameStreak = 1
    }
  }

  // ── 10. Entries with 0 hours but a start/end time ────────────────────────
  for (const [date, dayRows] of byDate.entries()) {
    for (const r of dayRows) {
      const reported = toNum(r.straight_hours) + toNum(r.premium_hours)
      if (reported === 0 && (r.start || r.end)) {
        flags.push({
          severity: 'medium',
          category: 'Zero Hours With Time',
          date,
          detail: `Entry has start=${r.start} end=${r.end} but 0 hours reported. Job: ${r.job ?? '—'}`,
        })
      }
    }
  }

  // ── Deduplicate identical flags ──────────────────────────────────────────
  const seen = new Set<string>()
  const dedupedFlags = flags.filter((f) => {
    const key = `${f.category}|${f.date}|${f.detail}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Sort: high → medium → low, then by date
  dedupedFlags.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity]
    return a.date.localeCompare(b.date)
  })

  const high = dedupedFlags.filter((f) => f.severity === 'high').length
  const medium = dedupedFlags.filter((f) => f.severity === 'medium').length
  const low = dedupedFlags.filter((f) => f.severity === 'low').length

  return {
    flags: dedupedFlags,
    summary: { high, medium, low, weekendDays, longestStreak, duplicates, mismatches, overlaps },
  }
}
