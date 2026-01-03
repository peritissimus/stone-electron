/**
 * Tag List Component
 *
 * Implements: specs/components.ts#TagListProps
 */

import React from 'react';
import { useTagStore } from '@renderer/stores/tagStore';
import { Button } from '@renderer/components/base/ui/button';
import { Text } from '@renderer/components/base/ui/text';
import { cn } from '@renderer/lib/utils';

export interface TagListProps {
  className?: string;
}

export function TagList({ className }: TagListProps) {
  const { tags, selectedTagIds, toggleTag } = useTagStore();

  if (tags.length === 0) {
    return (
      <div className={cn('p-3 text-center', className)}>
        <Text size="xs" variant="muted">
          No tags yet
        </Text>
      </div>
    );
  }

  return (
    <div className={cn('px-2 py-1', className)}>
      {tags.map((tag) => {
        const isSelected = selectedTagIds.includes(tag.id);
        return (
          <Button
            key={tag.id}
            onClick={() => toggleTag(tag.id)}
            variant="ghost"
            className={cn(
              'w-full flex items-center justify-between gap-2 px-2 py-1.5 h-auto font-normal',
              isSelected && 'bg-accent text-accent-foreground hover:bg-accent/90',
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: tag.color || 'hsl(var(--muted-foreground))' }}
              />
              <Text size="xs" as="span">
                {tag.name}
              </Text>
            </div>
            <Text size="xs" variant="muted" as="span">
              {tag.note_count}
            </Text>
          </Button>
        );
      })}
    </div>
  );
}
