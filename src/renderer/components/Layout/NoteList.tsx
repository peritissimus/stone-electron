/**
 * Note List Component - Display list of notes
 */

import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useNoteStore } from '@renderer/stores/noteStore'
import { useUIStore } from '@renderer/stores/uiStore'
import { useNotebookStore } from '@renderer/stores/notebookStore'
import { useNoteAPI } from '@renderer/hooks/useNoteAPI'
import { logger } from '@renderer/utils/logger'
import {
  Star,
  Pin,
  Archive,
  List,
  Grid3x3,
  LayoutGrid,
  ArrowUpDown,
  Plus,
} from 'lucide-react'

export function NoteList() {
  const { notes, activeNoteId, setActiveNote } = useNoteStore()
  const { viewMode, sortBy, sortOrder, showArchived, setViewMode, setSortBy, toggleSortOrder } = useUIStore()
  const { activeNotebookId } = useNotebookStore()
  const { createNote } = useNoteAPI()
  const [isCreating, setIsCreating] = useState(false)

  const filteredNotes = showArchived ? notes : notes.filter((n) => !n.isArchived)

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'updated':
        comparison = b.updatedAt - a.updatedAt
        break
      case 'created':
        comparison = b.createdAt - a.createdAt
        break
      case 'title':
        comparison = a.title.localeCompare(b.title)
        break
      case 'favorite':
        comparison = Number(b.isFavorite) - Number(a.isFavorite)
        break
    }

    return sortOrder === 'asc' ? -comparison : comparison
  })

  const handleCreateNote = async () => {
    if (isCreating) return

    setIsCreating(true)
    try {
      const note = await createNote({
        title: '',
        content: '',
        notebookId: activeNotebookId || undefined,
      })

      if (note) {
        setActiveNote(note.id)
      }
    } catch (error) {
      logger.error('Failed to create note:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-secondary">
      {/* Header */}
      <div className="px-4 pt-titlebar pb-3 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-base font-semibold text-foreground">Notes</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNote}
              disabled={isCreating}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              title="Create a new note"
            >
              <Plus size={14} />
              {isCreating ? 'Creating...' : 'New Note'}
            </button>
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
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground text-xs">
            <span>No notes found</span>
            <button
              onClick={handleCreateNote}
              disabled={isCreating}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              {isCreating ? 'Creating...' : 'Create your first note'}
            </button>
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
  const timeAgo = formatDistanceToNow(new Date(note.updatedAt * 1000), { addSuffix: true })

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
            {note.isPinned && <Pin size={12} className="text-primary" />}
            {note.isFavorite && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
            {note.isArchived && <Archive size={12} className="text-muted-foreground" />}
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
          {note.isPinned && <Pin size={10} className="text-primary" />}
          {note.isFavorite && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{preview}</p>
      <div className="text-xs text-muted-foreground/70">{timeAgo}</div>
    </button>
  )
}
