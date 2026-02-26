interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
}

export default function MetricCard({ label, value, sub, highlight }: MetricCardProps) {
  return (
    <div
      style={{ backgroundColor: '#1a1d27' }}
      className="rounded-xl p-5 flex flex-col gap-1"
    >
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</p>
      <p
        className={`text-3xl font-bold ${highlight ? 'text-orange-400' : 'text-white'}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}
