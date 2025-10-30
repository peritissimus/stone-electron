/**
 * Note Editor Component - TipTap Rich Text Editor
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import { useNoteStore } from '../../stores/noteStore'
import { useNoteAPI } from '../../hooks/useNoteAPI'
import { EditorToolbar } from '../Editor/EditorToolbar'
import { EditorContent } from '@tiptap/react'
import { Star, Pin, Archive, MoreVertical } from 'lucide-react'

export function NoteEditor() {
  const { getActiveNote } = useNoteStore()
  const { updateNote, toggleFavorite, togglePin, toggleArchive } = useNoteAPI()
  const activeNote = getActiveNote()

  const [title, setTitle] = useState('')
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-blue-600 dark:text-blue-400 underline' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full h-auto rounded-lg' },
      }),
      Highlight.configure({
        HTMLAttributes: { class: 'bg-yellow-200 dark:bg-yellow-800' },
      }),
    ],
    content: activeNote?.content || '',
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px]',
      },
    },
    onUpdate: ({ editor }) => {
      if (!activeNote) return

      // Debounce save
      if (saveTimeout) clearTimeout(saveTimeout)
      const timeout = setTimeout(() => {
        updateNote(activeNote.id, { content: editor.getHTML() })
      }, 1000)
      setSaveTimeout(timeout)
    },
  })

  // Update editor when active note changes
  useEffect(() => {
    if (activeNote && editor) {
      setTitle(activeNote.title)
      if (activeNote.content !== editor.getHTML()) {
        editor.commands.setContent(activeNote.content)
      }
    }
  }, [activeNote?.id, editor])

  // Handle title change
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      if (!activeNote) return

      if (saveTimeout) clearTimeout(saveTimeout)
      const timeout = setTimeout(() => {
        updateNote(activeNote.id, { title: newTitle })
      }, 500)
      setSaveTimeout(timeout)
    },
    [activeNote, updateNote, saveTimeout]
  )

  if (!activeNote) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No note selected</p>
          <p className="text-sm">Select a note from the list or create a new one</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950">
      {/* Editor Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="flex-1 text-2xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100"
        />

        {/* Note Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleFavorite(activeNote.id)}
            className={`p-2 rounded-lg transition-colors ${
              activeNote.is_favorite
                ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Toggle Favorite"
          >
            <Star size={20} fill={activeNote.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => togglePin(activeNote.id)}
            className={`p-2 rounded-lg transition-colors ${
              activeNote.is_pinned
                ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Toggle Pin"
          >
            <Pin size={20} />
          </button>
          <button
            onClick={() => toggleArchive(activeNote.id)}
            className={`p-2 rounded-lg transition-colors ${
              activeNote.is_archived
                ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Toggle Archive"
          >
            <Archive size={20} />
          </button>
          <button
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="More Options"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
