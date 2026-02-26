import type { RecentDay } from '@/lib/hoursData'

interface Props {
  data: RecentDay[]
}

export default function RecentActivity({ data }: Props) {
  const reversed = [...data].reverse()
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-700">
            <th className="text-left py-2 px-3 text-zinc-400 font-medium text-xs uppercase tracking-wider">Date</th>
            <th className="text-left py-2 px-3 text-zinc-400 font-medium text-xs uppercase tracking-wider">Day</th>
            <th className="text-right py-2 px-3 text-zinc-400 font-medium text-xs uppercase tracking-wider">Total</th>
            <th className="text-right py-2 px-3 text-zinc-400 font-medium text-xs uppercase tracking-wider">REG</th>
            <th className="text-right py-2 px-3 text-zinc-400 font-medium text-xs uppercase tracking-wider">OVT</th>
            <th className="text-left py-2 px-3 text-zinc-400 font-medium text-xs uppercase tracking-wider">Jobs</th>
          </tr>
        </thead>
        <tbody>
          {reversed.map((day) => (
            <tr
              key={day.date}
              className="border-b border-zinc-800 hover:bg-white/5 transition-colors"
            >
              <td className="py-2 px-3 text-zinc-300 font-mono text-xs">{day.date}</td>
              <td className="py-2 px-3 text-zinc-400 text-xs">{day.dayOfWeek}</td>
              <td className={`py-2 px-3 text-right font-semibold text-sm ${
                day.hours > 10 ? 'text-orange-400' : day.hours > 8 ? 'text-yellow-400' : 'text-white'
              }`}>
                {day.hours}h
              </td>
              <td className="py-2 px-3 text-right text-blue-400 text-xs">
                {day.straight > 0 ? `${day.straight}h` : '—'}
              </td>
              <td className="py-2 px-3 text-right text-xs">
                {day.overtime > 0
                  ? <span className="text-orange-400 font-medium">{day.overtime}h</span>
                  : <span className="text-zinc-600">—</span>}
              </td>
              <td className="py-2 px-3 text-zinc-400 text-xs">{day.jobs.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
