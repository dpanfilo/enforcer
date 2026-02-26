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
    adminHours: number
    adminPct: number
    unrecognizedCodes: string[]
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

function timeToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.trim()
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const min = parseInt(ampm[2], 10)
    const period = ampm[3].toUpperCase()
    if (period === 'AM' && h === 12) h = 0
    if (period === 'PM' && h !== 12) h += 12
    return isFinite(h) && isFinite(min) ? h * 60 + min : null
  }
  const h24 = s.match(/^(\d{1,2}):(\d{2})/)
  if (h24) {
    const h = parseInt(h24[1], 10)
    const min = parseInt(h24[2], 10)
    return isFinite(h) && isFinite(min) ? h * 60 + min : null
  }
  return null
}

// Known admin / non-billable codes
const ADMIN_CODES = new Set([
  'PREP WORK', 'job-prep',
  'Permit Submittals', 'PERMIT APPROVAL', 'permit-submittals', 'permit-prep',
  'emails', 'TEAM MEETINGS', 'meeting', 'team-questions',
  'DRAWING REVIEW', 'REVIEWER QUESTIONS', 'UPDATING STANDARDS',
  'ESPO', 'ESPO IT', 'it-help',
  'Driving',
  'Potential Client/Project Prep', 'TimeCard-Correction',
])

// Looks like a real structured job code: e.g. NCP-25-0123, DCS-24-3375
const JOB_CODE_RE = /^[A-Z]{2,4}-\d{2}-\d{3,5}$/

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

  const rows = allRows.map((r) => ({ ...r, date: normalizeDate(r.date) })).filter((r) => r.date)

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
      flags.push({ severity: 'high', category: 'Future Date', date,
        detail: `Entry dated ${date} is in the future (today is ${TODAY}).` })
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
        flags.push({ severity: 'high', category: 'Duplicate Entry', date,
          detail: `Duplicate row: start=${r.start} end=${r.end} job=${r.job ?? '—'}` })
      }
      seen.add(key)
    }
  }

  // ── 3. Overlapping time entries ──────────────────────────────────────────
  let overlaps = 0
  for (const [date, dayRows] of byDate.entries()) {
    const intervals: { startMin: number; endMin: number; job: string | null; start: string; end: string }[] = []
    for (const r of dayRows) {
      const s = timeToMinutes(r.start)
      const e = timeToMinutes(r.end)
      if (s !== null && e !== null && e > s)
        intervals.push({ startMin: s, endMin: e, job: r.job, start: r.start!, end: r.end! })
    }
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i], b = intervals[j]
        const overlapEnd = Math.min(a.endMin, b.endMin)
        const overlapStart = Math.max(a.startMin, b.startMin)
        if (overlapEnd > overlapStart) {
          overlaps++
          flags.push({ severity: 'high', category: 'Overlapping Entries', date,
            detail: `${a.start}–${a.end} (${a.job ?? '—'}) overlaps ${b.start}–${b.end} (${b.job ?? '—'}) by ${overlapEnd - overlapStart} min.` })
        }
      }
    }
  }

  // ── 4. Hours mismatch: reported vs clock-in/out ──────────────────────────
  let mismatches = 0
  for (const [date, dayRows] of byDate.entries()) {
    for (const r of dayRows) {
      const s = timeToMinutes(r.start)
      const e = timeToMinutes(r.end)
      if (s === null || e === null || e <= s) continue
      const clockHours = (e - s) / 60
      const reportedHours = toNum(r.straight_hours) + toNum(r.premium_hours)
      if (reportedHours === 0) continue
      const diff = Math.abs(clockHours - reportedHours)
      if (diff > 0.26) {
        mismatches++
        flags.push({
          severity: diff > 1 ? 'high' : 'medium',
          category: 'Hours Mismatch', date,
          detail: `${r.start}–${r.end} = ${clockHours.toFixed(2)}h on clock, but ${reportedHours}h reported (diff ${diff.toFixed(2)}h). Job: ${r.job ?? '—'}`,
        })
      }
    }
  }

  // ── 5. Extremely long days (>14h) ────────────────────────────────────────
  for (const [date, dayRows] of byDate.entries()) {
    const total = dayRows.reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0)
    if (total > 14)
      flags.push({ severity: 'medium', category: 'Extremely Long Day', date,
        detail: `${total.toFixed(2)}h reported in a single day.` })
  }

  // ── 6. Very early start / very late end ──────────────────────────────────
  for (const [date, dayRows] of byDate.entries()) {
    for (const r of dayRows) {
      const s = timeToMinutes(r.start)
      const e = timeToMinutes(r.end)
      if (s !== null && s < 5 * 60)
        flags.push({ severity: 'low', category: 'Unusual Hours', date,
          detail: `Start time ${r.start} is before 5:00 AM. Job: ${r.job ?? '—'}` })
      if (e !== null && e >= 23 * 60)
        flags.push({ severity: 'low', category: 'Unusual Hours', date,
          detail: `End time ${r.end} is at or after 11:00 PM. Job: ${r.job ?? '—'}` })
    }
  }

  // ── 7. Weekend work ──────────────────────────────────────────────────────
  let weekendDays = 0
  for (const date of byDate.keys()) {
    const dow = new Date(date + 'T00:00:00').getDay()
    if (dow === 0 || dow === 6) {
      weekendDays++
      const total = byDate.get(date)!.reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0)
      flags.push({ severity: 'low', category: 'Weekend Work', date,
        detail: `Worked ${total.toFixed(2)}h on a ${dow === 0 ? 'Sunday' : 'Saturday'}.` })
    }
  }

  // ── 8. Consecutive work streaks >10 days ────────────────────────────────
  const sortedDates = Array.from(byDate.keys()).sort()
  let streak = 1, longestStreak = 1, streakStart = sortedDates[0] ?? ''
  for (let i = 1; i < sortedDates.length; i++) {
    const diffDays = Math.round(
      (new Date(sortedDates[i] + 'T00:00:00').getTime() -
       new Date(sortedDates[i - 1] + 'T00:00:00').getTime()) / 86400000
    )
    if (diffDays === 1) {
      streak++
      if (streak > longestStreak) longestStreak = streak
      if (streak > 10)
        flags.push({ severity: 'medium', category: 'Long Work Streak', date: sortedDates[i],
          detail: `Day ${streak} of consecutive work starting ${streakStart}. No day off in ${streak} days.` })
    } else {
      streak = 1
      streakStart = sortedDates[i]
    }
  }

  // ── 9. Identical daily totals (≥5 consecutive days) ─────────────────────
  const dailyTotals = sortedDates.map((d) => ({
    date: d,
    total: byDate.get(d)!.reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0),
  }))
  let sameStreak = 1
  for (let i = 1; i < dailyTotals.length; i++) {
    if (Math.abs(dailyTotals[i].total - dailyTotals[i - 1].total) < 0.01) {
      sameStreak++
      if (sameStreak >= 5)
        flags.push({ severity: 'low', category: 'Identical Daily Hours', date: dailyTotals[i].date,
          detail: `Exactly ${dailyTotals[i].total}h reported for ${sameStreak} consecutive days (since ${dailyTotals[i - sameStreak + 1].date}).` })
    } else { sameStreak = 1 }
  }

  // ── 10. Zero hours with a time entry ────────────────────────────────────
  for (const [date, dayRows] of byDate.entries()) {
    for (const r of dayRows) {
      if (toNum(r.straight_hours) + toNum(r.premium_hours) === 0 && (r.start || r.end))
        flags.push({ severity: 'medium', category: 'Zero Hours With Time', date,
          detail: `Entry has start=${r.start} end=${r.end} but 0 hours reported. Job: ${r.job ?? '—'}` })
    }
  }

  // ── 11. Daily admin time concentration (≥80% of day, min 4h total) ───────
  for (const [date, dayRows] of byDate.entries()) {
    const dayTotal = dayRows.reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0)
    if (dayTotal < 4) continue
    const adminTotal = dayRows
      .filter((r) => r.job && ADMIN_CODES.has(r.job))
      .reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0)
    const pct = dayTotal > 0 ? adminTotal / dayTotal : 0
    if (pct >= 0.8) {
      flags.push({
        severity: pct === 1 ? 'medium' : 'low',
        category: 'High Admin Day',
        date,
        detail: `${(pct * 100).toFixed(0)}% of ${dayTotal.toFixed(2)}h (${adminTotal.toFixed(2)}h) coded to non-billable admin — no project work recorded.`,
      })
    }
  }

  // ── 12. PREP WORK daily excess (>5h in a day) ────────────────────────────
  for (const [date, dayRows] of byDate.entries()) {
    const prepHours = dayRows
      .filter((r) => r.job === 'PREP WORK' || r.job === 'job-prep')
      .reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0)
    if (prepHours > 5) {
      flags.push({
        severity: 'medium',
        category: 'Excessive Prep Work',
        date,
        detail: `${prepHours.toFixed(2)}h billed to PREP WORK / job-prep in a single day — no specific project attached.`,
      })
    }
  }

  // ── 13. Driving billed ───────────────────────────────────────────────────
  for (const [date, dayRows] of byDate.entries()) {
    for (const r of dayRows) {
      if (r.job === 'Driving') {
        const h = toNum(r.straight_hours) + toNum(r.premium_hours)
        flags.push({
          severity: 'low',
          category: 'Driving Billed',
          date,
          detail: `${h.toFixed(2)}h billed under "Driving" code. Verify if drive time is a compensable category per policy.`,
        })
      }
    }
  }

  // ── 14. Admin code fragmentation summary (one-time insight) ─────────────
  const prepTotal = rows.reduce((s, r) =>
    (r.job === 'PREP WORK' || r.job === 'job-prep') ? s + toNum(r.straight_hours) + toNum(r.premium_hours) : s, 0)
  const permitTotal = rows.reduce((s, r) =>
    ['Permit Submittals','PERMIT APPROVAL','permit-submittals','permit-prep'].includes(r.job ?? '')
      ? s + toNum(r.straight_hours) + toNum(r.premium_hours) : s, 0)
  const totalHours = rows.reduce((s, r) => s + toNum(r.straight_hours) + toNum(r.premium_hours), 0)
  const adminHours = rows.reduce((s, r) =>
    r.job && ADMIN_CODES.has(r.job) ? s + toNum(r.straight_hours) + toNum(r.premium_hours) : s, 0)
  const adminPct = totalHours > 0 ? Math.round((adminHours / totalHours) * 100) : 0

  flags.push({
    severity: 'medium',
    category: 'Admin Code Fragmentation',
    date: '—',
    detail: `${adminPct}% of all hours (${adminHours.toFixed(0)}h / ${totalHours.toFixed(0)}h) are on non-billable admin codes. Prep-type codes split across "PREP WORK" + "job-prep" = ${prepTotal.toFixed(0)}h. Permit-type codes split across 4 variations = ${permitTotal.toFixed(0)}h. Fragmented naming obscures total exposure.`,
  })

  // ── 15. Unrecognized job codes (look real but missing from jobs table) ───
  const structuredCodes = [...new Set(rows.map((r) => r.job).filter((j): j is string => !!j && JOB_CODE_RE.test(j)))]
  const unrecognizedCodes: string[] = []

  if (structuredCodes.length > 0) {
    const foundCodes = new Set<string>()
    for (let i = 0; i < structuredCodes.length; i += 100) {
      const chunk = structuredCodes.slice(i, i + 100)
      const { data } = await supabase.from('jobs').select('full_number').in('full_number', chunk)
      for (const r of data ?? []) foundCodes.add(r.full_number)
    }
    for (const code of structuredCodes) {
      if (!foundCodes.has(code)) unrecognizedCodes.push(code)
    }
    for (const code of unrecognizedCodes) {
      const h = rows.reduce((s, r) =>
        r.job === code ? s + toNum(r.straight_hours) + toNum(r.premium_hours) : s, 0)
      flags.push({
        severity: 'high',
        category: 'Unrecognized Job Code',
        date: '—',
        detail: `"${code}" looks like a structured job number but does not exist in the jobs database. ${h.toFixed(2)}h billed against it.`,
      })
    }
  }

  // ── Deduplicate & sort ───────────────────────────────────────────────────
  const seenKeys = new Set<string>()
  const dedupedFlags = flags.filter((f) => {
    const key = `${f.category}|${f.date}|${f.detail}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })

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
    summary: {
      high, medium, low, weekendDays, longestStreak,
      duplicates, mismatches, overlaps,
      adminHours: Math.round(adminHours * 100) / 100,
      adminPct,
      unrecognizedCodes,
    },
  }
}
