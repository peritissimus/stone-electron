/**
 * Search Panel Component
 */

import React, { useState, useEffect } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useNoteStore } from '../../stores/noteStore'
import { useSearchAPI } from '../../hooks/useSearchAPI'
import { Search, X, Loader, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function SearchPanel() {
  const { searchQuery, setSearchQuery, toggleSearch } = useUIStore()
  const { setActiveNote } = useNoteStore()
  const { fullTextSearch, loading } = useSearchAPI()

  const [results, setResults] = useState<any[]>([])
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    // Debounce search
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(async () => {
      const searchResults = await fullTextSearch(searchQuery, { limit: 20 })
      if (searchResults) {
        setResults(searchResults.results)
      }
    }, 300)
    setSearchTimeout(timeout)

    return () => {
      if (searchTimeout) clearTimeout(searchTimeout)
    }
  }, [searchQuery])

  const handleSelectNote = (noteId: string) => {
    setActiveNote(noteId)
    toggleSearch()
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Search Input */}
      <div className="p-4 flex items-center gap-3">
        <Search size={18} className="text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes..."
          className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100"
          autoFocus
        />
        {loading && <Loader size={18} className="text-gray-400 animate-spin" />}
        <button
          onClick={toggleSearch}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="max-h-96 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
          {results.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No results found for "{searchQuery}"
            </div>
          )}

          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelectNote(result.id)}
              className="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 text-left transition-colors"
            >
              <div className="flex items-start gap-3">
                <FileText size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {result.title || 'Untitled'}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {result.content_highlight || result.content?.substring(0, 150)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {formatDistanceToNow(new Date(result.updatedAt * 1000), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
