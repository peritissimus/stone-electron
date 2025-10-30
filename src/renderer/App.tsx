/**
 * Stone - Main App Component
 */

import React, { useEffect } from 'react'
import { MainLayout } from './components/Layout/MainLayout'
import { useUIStore } from './stores/uiStore'

export const App: React.FC = () => {
  const theme = useUIStore((state) => state.theme)

  useEffect(() => {
    const root = document.documentElement

    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // System preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [theme])

  return <MainLayout />
}
