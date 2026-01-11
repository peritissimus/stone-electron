import React, { memo } from 'react';
import { FileText, BookOpen, ArrowRight, Sparkle, CaretRight, PencilSimple, Plus } from 'phosphor-react';
import { useHomePageData } from '@renderer/hooks/useHomePageData';
import { formatRelativeDate, getGreeting, getFolderPath } from '@renderer/utils/dateFormat';
import { TodoList } from './TodoList';
import { IconButton, ListItem, sizeHeightClasses } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';

interface RecentNoteProps {
  note: {
    id: string;
    title: string | null;
    updatedAt: Date;
    filePath: string | null;
  };
  onClick: (id: string) => void;
}

const RecentNote = memo<RecentNoteProps>(function RecentNote({ note, onClick }) {
  const folderPath = getFolderPath(note.filePath);

  return (
    <ListItem
      size="normal"
      onClick={() => onClick(note.id)}
      className="rounded-lg border-none"
      left={<FileText className="w-4 h-4" />}
      title={note.title || 'Untitled'}
      subtitle={folderPath}
      right={<span className="text-xs text-muted-foreground">{formatRelativeDate(note.updatedAt)}</span>}
    />
  );
});

export function HomePage() {
  const {
    notes,
    recentNotes,
    continueNote,
    todaysJournal,
    journalFilename,
    journalTitle,
    totalNotes,
    todayNotes,
    sidebarOpen,
    toggleSidebar,
    handleNoteClick,
    handleJournalClick,
    handleWorkNoteClick,
  } = useHomePageData();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'px-4 border-b border-border shrink-0 bg-card flex items-center gap-3',
          sizeHeightClasses['spacious'],
        )}
      >
        {!sidebarOpen && (
          <IconButton
            size="normal"
            icon={<CaretRight size={16} weight="bold" />}
            tooltip="Expand sidebar"
            onClick={toggleSidebar}
          />
        )}
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground">
          {totalNotes} notes · {todayNotes} today
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-10 space-y-8">
          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-semibold mb-1">{getGreeting()}</h1>
            <p className="text-muted-foreground">{journalTitle}</p>
          </div>

          {/* Smart Actions */}
          <div className="space-y-3">
            {/* Continue Writing - only show if there's a recent note */}
            {continueNote && (
              <button
                onClick={() => handleNoteClick(continueNote.id)}
                className="w-full flex items-center gap-3 p-4 rounded-lg bg-accent/20 hover:bg-accent/30 transition-colors group text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <PencilSimple size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    Continue writing
                    <ArrowRight
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {continueNote.title || 'Untitled'}
                  </div>
                </div>
              </button>
            )}

            {/* Today's Journal */}
            <button
              onClick={handleJournalClick}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group text-left"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <BookOpen size={20} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  {todaysJournal ? "Open today's journal" : "Start today's journal"}
                  <ArrowRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <div className="text-xs text-muted-foreground">{journalFilename}</div>
              </div>
              {!todaysJournal && <Sparkle size={16} className="text-primary" />}
            </button>

            {/* Quick Note */}
            <button
              onClick={handleWorkNoteClick}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group text-left"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Plus size={20} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  New note
                  <ArrowRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <div className="text-xs text-muted-foreground">Create a quick note</div>
              </div>
            </button>
          </div>

          {/* Active Tasks */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Tasks</h2>
            <TodoList onTodoClick={handleNoteClick} />
          </div>

          {/* Recent Notes */}
          {recentNotes.length > 1 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent</h2>
              <div className="space-y-1">
                {recentNotes.slice(1).map((note) => (
                  <RecentNote
                    key={note.id}
                    note={{
                      id: note.id,
                      title: note.title,
                      updatedAt: note.updatedAt,
                      filePath: note.filePath,
                    }}
                    onClick={handleNoteClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {notes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">No notes yet</h3>
              <p className="text-sm text-muted-foreground">Create your first note to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
