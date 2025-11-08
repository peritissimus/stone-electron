/**
 * Note Editor Empty State Component
 */
import { Article, Plus } from 'phosphor-react';
import { Button } from '@renderer/components/base/ui/button';

export function NoteEditorEmptyState() {
  return (
    <div className="flex-1 bg-background flex flex-col items-center justify-center px-8 py-16">
      <div className="text-center max-w-md">
        {/* Icon Circle */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-linear-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Article size={36} className="text-primary" />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-semibold mb-3 text-foreground">No note selected</h2>

        {/* Description */}
        <p className="text-muted-foreground mb-8 leading-relaxed text-base">
          Select a note from the sidebar to view and edit it, or create a new one to get started
          with your writing.
        </p>

        {/* CTA Button */}
        <Button
          onClick={() => {
            const noteListButton = document.querySelector(
              '[title="Create a new note"]',
            ) as HTMLButtonElement;
            noteListButton?.click();
          }}
          className="h-10 px-6 text-sm font-medium"
          size="lg"
        >
          <Plus size={16} className="mr-2" />
          Create your first note
        </Button>
      </div>
    </div>
  );
}
