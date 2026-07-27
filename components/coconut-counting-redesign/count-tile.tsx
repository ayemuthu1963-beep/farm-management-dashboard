interface CountTileProps {
  title: string
  grade: 'A' | 'B'
  count: number
  variant: 'fixed' | 'manual'
}

export function CountTile({ title, grade, count, variant }: CountTileProps) {
  const bgColor = grade === 'A' ? 'bg-green-600' : 'bg-blue-600'
  const textColor = grade === 'A' ? 'text-green-600' : 'text-blue-600'

  return (
    <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
      <div className={`${bgColor} px-3 py-2 text-white`}>
        <h3 className="text-xs font-bold tracking-tight">{title}</h3>
      </div>
      <div className="p-3 space-y-3 text-center">
        <div>
          <p className={`text-2xl font-bold ${textColor}`}>{count}</p>
          <p className="text-xs text-gray-500 font-medium">
            {variant === 'fixed' ? 'FIXED COUNT' : 'ENTER PAIRS'}
          </p>
        </div>
        <button className={`w-full ${bgColor} hover:opacity-90 text-white font-bold py-2 px-3 rounded transition-opacity text-sm`}>
          SEND
        </button>
      </div>
    </div>
  )
}
