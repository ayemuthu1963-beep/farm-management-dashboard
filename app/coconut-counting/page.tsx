'use client'

import { useState } from 'react'
import { MainCountingScreen } from '@/components/coconut-counting/main-counting-screen'
import { TodaysHistoryScreen } from '@/components/coconut-counting/todays-history-screen'
import { DateHistoryScreen } from '@/components/coconut-counting/date-history-screen'

export default function CoconutCountingPage() {
  const [currentScreen, setCurrentScreen] = useState<'main' | 'history' | 'date'>('main')

  return (
    <>
      {currentScreen === 'main' && (
        <MainCountingScreen
          onHistoryClick={() => setCurrentScreen('history')}
          onDateClick={() => setCurrentScreen('date')}
          onResetClick={() => {/* Reset logic */}}
        />
      )}
      {currentScreen === 'history' && (
        <TodaysHistoryScreen
          onBack={() => setCurrentScreen('main')}
          onExport={(date) => {/* Export logic */}}
        />
      )}
      {currentScreen === 'date' && (
        <DateHistoryScreen
          onBack={() => setCurrentScreen('main')}
          onExport={(date) => {/* Export logic */}}
        />
      )}
    </>
  )
}
