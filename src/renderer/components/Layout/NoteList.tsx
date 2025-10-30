/**
 * Note List Component - Display list of notes
 */

import React from 'react'
import { useNoteStore } from '../../stores/noteStore'
import { useUIStore } from '../../stores/uiStore'
import { formatDistanceToNow } from 'date-fns'
import {
  Star,
  Pin,
  Archive,
  MoreVertical,
  List,
  Grid3x3,
  LayoutGrid,
  ArrowUpDown,
} from 'lucide-react'

export function NoteList() {
  const { notes, activeNoteId, setActiveNote } = useNoteStore()
  const { viewMode, sortBy, sortOrder, showArchived, setViewMode, setSortBy, toggleSortOrder } = useUIStore()

  const filteredNotes = showArchived ? notes : notes.filter((n) => !n.is_archived)

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'updated':
        comparison = b.updated_at - a.updated_at
        break
      case 'created':
        comparison = b.created_at - a.created_at
        break
      case 'title':
        comparison = a.title.localeCompare(b.title)
        break
      case 'favorite':
        comparison = Number(b.is_favorite) - Number(a.is_favorite)
        break
    }

    return sortOrder === 'asc' ? -comparison : comparison
  })

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-850">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notes</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${
                viewMode === 'list'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${
                viewMode === 'grid'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Grid view"
            >
              <Grid3x3 size={16} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded ${
                viewMode === 'card'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Card view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="updated">Last Updated</option>
            <option value="created">Created Date</option>
            <option value="title">Title</option>
            <option value="favorite">Favorites</option>
          </select>
          <button
            onClick={toggleSortOrder}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown size={16} />
          </button>
        </div>

        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
        </div>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        {sortedNotes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
            No notes found
          </div>
        ) : (
          <div className={viewMode === 'list' ? 'divide-y divide-gray-200 dark:divide-gray-700' : 'p-2 grid grid-cols-2 gap-2'}>
            {sortedNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                isActive={note.id === activeNoteId}
                onClick={() => setActiveNote(note.id)}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface NoteItemProps {
  note: any
  isActive: boolean
  onClick: () => void
  viewMode: 'list' | 'grid' | 'card'
}

function NoteItem({ note, isActive, onClick, viewMode }: NoteItemProps) {
  const preview = note.content.replace(/[#*`>\-\[\]]/g, '').substring(0, 100)
  const timeAgo = formatDistanceToNow(new Date(note.updated_at * 1000), { addSuffix: true })

  if (viewMode === 'list') {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left p-4 transition-colors ${
          isActive
            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-transparent'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{note.title || 'Untitled'}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {note.is_pinned && <Pin size={14} className="text-blue-600" />}
            {note.is_favorite && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
            {note.is_archived && <Archive size={14} className="text-gray-400" />}
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{preview}</p>
        <div className="text-xs text-gray-500 dark:text-gray-500">{timeAgo}</div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-all ${
        isActive
          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm line-clamp-2">{note.title || 'Untitled'}</h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {note.is_pinned && <Pin size={12} className="text-blue-600" />}
          {note.is_favorite && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
        </div>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 mb-2">{preview}</p>
      <div className="text-xs text-gray-500 dark:text-gray-500">{timeAgo}</div>
    </button>
  )
}
