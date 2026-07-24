'use client'

import { useState } from 'react'
import MainCountingScreen from '@/components/coconut-counting/main-counting-screen'
import TodaysHistoryScreen from '@/components/coconut-counting/todays-history-screen'
import DatewiseHistoryScreen from '@/components/coconut-counting/datewise-history-screen'

export default function CoconutCountingPage() {
  const [currentScreen, setCurrentScreen] = useState<'main' | 'history' | 'dateHistory'>('main')

  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen as 'main' | 'history' | 'dateHistory')
  }

  return (
    <>
      {currentScreen === 'main' && <MainCountingScreen onNavigate={handleNavigate} />}
      {currentScreen === 'history' && <TodaysHistoryScreen onNavigate={handleNavigate} />}
      {currentScreen === 'dateHistory' && <DatewiseHistoryScreen onNavigate={handleNavigate} />}
    </>
  )
}
