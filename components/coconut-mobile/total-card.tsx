'use client'

interface TotalCardProps {
  label: string
  value: number
  variant: 'a' | 'b' | 'combined'
}

export function TotalCard({ label, value, variant }: TotalCardProps) {
  const colors = {
    a: 'bg-green-100 border-green-300',
    b: 'bg-blue-100 border-blue-300',
    combined: 'bg-teal-100 border-teal-300',
  }

  const textColor = {
    a: 'text-green-800',
    b: 'text-blue-800',
    combined: 'text-teal-800',
  }

  return (
    <div className={`${colors[variant]} border-2 rounded-lg px-2 py-2 text-center flex-1`}>
      <p className={`text-xs font-semibold ${textColor[variant]} truncate`}>{label}</p>
      <p className={`text-2xl font-bold ${textColor[variant]} leading-tight`}>{value.toLocaleString()}</p>
    </div>
  )
}
