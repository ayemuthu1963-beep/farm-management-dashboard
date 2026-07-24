'use client'

import { useState } from 'react'
import { MainCountingScreen } from '@/components/coconut-counting-v2/main-counting-screen'
import { TodaysHistoryScreen } from '@/components/coconut-counting-v2/todays-history-screen'
import { DateSelectorScreen } from '@/components/coconut-counting-v2/date-selector-screen'

type Screen = 'counting' | 'today-history' | 'date-history'

export default function CoconutCountingPage() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('counting')

  return (
    <>
      {currentScreen === 'counting' && (
        <MainCountingScreen
          onNavigateToHistory={() => setCurrentScreen('today-history')}
          onNavigateToDate={() => setCurrentScreen('date-history')}
        />
      )}
      {currentScreen === 'today-history' && (
        <TodaysHistoryScreen onBack={() => setCurrentScreen('counting')} />
      )}
      {currentScreen === 'date-history' && (
        <DateSelectorScreen onBack={() => setCurrentScreen('counting')} />
      )}
    </>
  )
}
