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
    <div className="flex flex-col h-full bg-secondary">
      {/* Header */}
      <div className="px-4 pt-titlebar pb-3 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Notes</h2>
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="List view"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${
                viewMode === 'grid'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Grid view"
            >
              <Grid3x3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded ${
                viewMode === 'card'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Card view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="flex-1 px-2.5 py-1.5 text-xs border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
          >
            <option value="updated">Last Updated</option>
            <option value="created">Created Date</option>
            <option value="title">Title</option>
            <option value="favorite">Favorites</option>
          </select>
          <button
            onClick={toggleSortOrder}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown size={14} />
          </button>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
        </div>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto bg-card">
        {sortedNotes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No notes found
          </div>
        ) : (
          <div className={viewMode === 'list' ? 'divide-y divide-border' : 'p-2 grid grid-cols-2 gap-2'}>
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
        className={`w-full text-left px-3 py-2 transition-colors ${
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted/50'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium text-foreground text-sm line-clamp-1">{note.title || 'Untitled'}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {note.is_pinned && <Pin size={12} className="text-primary" />}
            {note.is_favorite && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
            {note.is_archived && <Archive size={12} className="text-muted-foreground" />}
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{preview}</p>
        <div className="text-xs text-muted-foreground/70">{timeAgo}</div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`text-left p-2.5 rounded-lg transition-all ${
        isActive
          ? 'bg-accent ring-1 ring-primary shadow-sm'
          : 'bg-background hover:bg-muted/50 border border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="font-medium text-foreground text-xs line-clamp-2">{note.title || 'Untitled'}</h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {note.is_pinned && <Pin size={10} className="text-primary" />}
          {note.is_favorite && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{preview}</p>
      <div className="text-xs text-muted-foreground/70">{timeAgo}</div>
    </button>
  )
}
