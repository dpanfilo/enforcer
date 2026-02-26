'use client'

import type { CalendarHeatmapData, CalendarDay } from '@/lib/hoursData'

interface Props { data: CalendarHeatmapData }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function cellColor(day: CalendarDay): string {
  if (!day.hasEntry) return '#1e2030'
  if (day.hours <= 0) return '#1e2030'
  if (day.hours <= 4) return '#166534'
  if (day.hours <= 8) return '#16a34a'
  if (day.hours <= 12) return '#22c55e'
  return '#4ade80'
}

function getMondayBefore(dateStr: string): Date {
  const dt = new Date(dateStr + 'T00:00:00')
  const offset = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - offset)
  return dt
}

function toDateStr(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

interface Week {
  monday: Date
  days: (CalendarDay | null)[]
}

export default function CalendarHeatmap({ data }: Props) {
  // Build a quick lookup
  const dayMap = new Map<string, CalendarDay>()
  for (const d of data.days) dayMap.set(d.date, d)

  // Build week columns starting from Monday of startDate
  const startMonday = getMondayBefore(data.startDate)
  const endDate = new Date(data.endDate + 'T00:00:00')

  const weeks: Week[] = []
  const cur = new Date(startMonday)

  while (cur <= endDate) {
    const week: Week = { monday: new Date(cur), days: [] }
    for (let dow = 0; dow < 7; dow++) {
      const ds = toDateStr(cur)
      const day = dayMap.get(ds) ?? null
      // Only include days within our range
      if (new Date(ds + 'T00:00:00') < new Date(data.startDate + 'T00:00:00') ||
          new Date(ds + 'T00:00:00') > endDate) {
        week.days.push(null)
      } else {
        week.days.push(day ?? { date: ds, hours: 0, hasEntry: false })
      }
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  // Month label: show month name above first week of each month
  function getMonthLabel(week: Week, i: number): string | null {
    const m = week.monday.getMonth()
    if (i === 0) return MONTH_NAMES[m] ?? null
    const prev = weeks[i - 1]
    if (!prev) return null
    return prev.monday.getMonth() !== m ? MONTH_NAMES[m] ?? null : null
  }

  const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">
        Each cell = one day · color = hours worked · hover for details
      </p>
      <div className="overflow-x-auto pb-2">
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
          {/* Month labels */}
          <div style={{ display: 'flex', gap: 2, paddingLeft: 20 }}>
            {weeks.map((week, i) => {
              const label = getMonthLabel(week, i)
              return (
                <div key={i} style={{ width: 12, fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {label ?? ''}
                </div>
              )
            })}
          </div>

          {/* Day rows */}
          {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
            <div key={dow} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {/* Day-of-week label */}
              <div style={{ width: 16, fontSize: 9, color: '#4b5563', textAlign: 'right', marginRight: 2, flexShrink: 0 }}>
                {dow % 2 === 0 ? DOW_LABELS[dow] : ''}
              </div>
              {weeks.map((week, wi) => {
                const day = week.days[dow]
                if (!day) {
                  return <div key={wi} style={{ width: 12, height: 12 }} />
                }
                const dow2 = new Date(day.date + 'T00:00:00').getDay()
                const isWeekend = dow2 === 0 || dow2 === 6
                return (
                  <div
                    key={wi}
                    title={day.hasEntry ? `${day.date}: ${day.hours}h` : `${day.date}: no entry`}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      backgroundColor: cellColor(day),
                      opacity: isWeekend && day.hasEntry ? 0.7 : 1,
                      flexShrink: 0,
                      cursor: 'default',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 text-xs text-zinc-500">
        <span>Less</span>
        {['#1e2030', '#166534', '#16a34a', '#22c55e', '#4ade80'].map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: c }} />
        ))}
        <span>More</span>
        <span className="ml-3 text-zinc-600">· 0h · &lt;4h · 4–8h · 8–12h · 12h+</span>
      </div>
    </div>
  )
}
