/**
 * Tag List Component - Placeholder
 */

import React from 'react'
import { useTagStore } from '../../stores/tagStore'
import { Tag } from 'lucide-react'

export function TagList() {
  const { tags, selectedTagIds, toggleTag } = useTagStore()

  if (tags.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
        No tags yet
      </div>
    )
  }

  return (
    <div className="p-2">
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => toggleTag(tag.id)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedTagIds.includes(tag.id)
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <span>{tag.name}</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {tag.note_count}
          </span>
        </button>
      ))}
    </div>
  )
}
