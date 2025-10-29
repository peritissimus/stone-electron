/**
 * Stone - Main App Component
 */

import React from 'react'

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">🪨 Stone</h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            A production-ready note-taking application
          </p>
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-500">
            Architecture and database setup complete. Ready for implementation.
          </p>
        </div>
      </div>
    </div>
  )
}
