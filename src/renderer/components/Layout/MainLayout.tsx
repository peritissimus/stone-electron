/**
 * Main Layout Component
 */

import React, { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { NoteList } from './NoteList'
import { NoteEditor } from './NoteEditor'
import { SearchPanel } from './SearchPanel'
import { SettingsModal } from '../Settings/SettingsModal'
import { useUIStore } from '../../stores/uiStore'
import { useNotebookAPI } from '../../hooks/useNotebookAPI'
import { useTagAPI } from '../../hooks/useTagAPI'
import { useNoteAPI } from '../../hooks/useNoteAPI'

export function MainLayout() {
  const {
    sidebarOpen,
    sidebarWidth,
    noteListWidth,
    editorFullscreen,
    searchOpen,
    setSidebarWidth,
    setNoteListWidth,
  } = useUIStore()

  const { loadNotebooks } = useNotebookAPI()
  const { loadTags } = useTagAPI()
  const { loadNotes } = useNoteAPI()

  // Load initial data
  useEffect(() => {
    loadNotebooks()
    loadTags()
    loadNotes()
  }, [loadNotebooks, loadTags, loadNotes])

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && !editorFullscreen && (
        <>
          <div
            className="flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"
            style={{ width: `${sidebarWidth}px` }}
          >
            <Sidebar />
          </div>

          {/* Sidebar Resizer */}
          <div
            className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault()
              const startX = e.clientX
              const startWidth = sidebarWidth

              const handleMouseMove = (e: MouseEvent) => {
                const delta = e.clientX - startX
                setSidebarWidth(startWidth + delta)
              }

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
              }

              document.addEventListener('mousemove', handleMouseMove)
              document.addEventListener('mouseup', handleMouseUp)
            }}
          />
        </>
      )}

      {/* Note List */}
      {!editorFullscreen && (
        <>
          <div
            className="flex-shrink-0 bg-gray-50 dark:bg-gray-850 border-r border-gray-200 dark:border-gray-700"
            style={{ width: `${noteListWidth}px` }}
          >
            <NoteList />
          </div>

          {/* Note List Resizer */}
          <div
            className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-800 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault()
              const startX = e.clientX
              const startWidth = noteListWidth

              const handleMouseMove = (e: MouseEvent) => {
                const delta = e.clientX - startX
                setNoteListWidth(startWidth + delta)
              }

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
              }

              document.addEventListener('mousemove', handleMouseMove)
              document.addEventListener('mouseup', handleMouseUp)
            }}
          />
        </>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {searchOpen && <SearchPanel />}
        <NoteEditor />
      </div>

      {/* Settings Modal */}
      <SettingsModal />
    </div>
  )
}
