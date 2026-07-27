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
    <div className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className={`${bgColor} px-4 py-3 text-white`}>
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full ${bgColor} font-bold text-white text-lg`}>
            {grade}
            {variant === 'fixed' ? '1' : '2'}
          </div>
          <span className="text-3xl">🥥</span>
        </div>
        <div className="text-center">
          <p className={`text-3xl font-bold ${textColor}`}>{count}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">
            {variant === 'fixed' ? 'FIXED COUNT' : 'ENTER PAIRS'}
          </p>
        </div>
        <button className={`w-full ${bgColor} hover:opacity-90 text-white font-bold py-3 px-4 rounded-lg transition-opacity flex items-center justify-center gap-2`}>
          <span>➤</span>
          <span>SEND</span>
        </button>
      </div>
    </div>
  )
}
