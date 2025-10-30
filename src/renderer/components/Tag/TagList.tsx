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
      <div className="p-3 text-xs text-muted-foreground text-center">
        No tags yet
      </div>
    )
  }

  return (
    <div className="px-2 py-1">
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => toggleTag(tag.id)}
          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
            selectedTagIds.includes(tag.id)
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <span>{tag.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {tag.note_count}
          </span>
        </button>
      ))}
    </div>
  )
}
