import React, { useRef } from 'react';
import { FileText, BookOpen, ArrowRight, Sparkles } from 'lucide-react';
import { CaretRight, PencilSimple, Plus } from 'phosphor-react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { logger } from '@renderer/utils/logger';
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

// Format relative date
const formatDate = (dateInput: Date | string) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  }
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  return date.toLocaleDateString();
};

// Extract folder path from file path
const getFolderPath = (filePath: string | null) => {
  if (!filePath) return null;
  const normalizedPath = filePath.replace(/\\/g, '/');
  const lastSlash = normalizedPath.lastIndexOf('/');
  return lastSlash > 0 ? normalizedPath.substring(0, lastSlash) : null;
};

const RecentNote: React.FC<RecentNoteProps> = ({ note, onClick }) => {
  const folderPath = getFolderPath(note.filePath);

  return (
    <ListItem
      size="normal"
      onClick={() => onClick(note.id)}
      className="rounded-lg border-none"
      left={<FileText className="w-4 h-4" />}
      title={note.title || 'Untitled'}
      subtitle={folderPath}
      right={
        <span className="text-xs text-muted-foreground">
          {formatDate(note.updatedAt)}
        </span>
      }
    />
  );
};

// Get time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Normalize path for comparison (handle backslashes, leading slashes, case differences)
function normalizePath(path: string | null): string {
  if (!path) return '';
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

export function HomePage() {
  const { notes, setActiveNote } = useNoteStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const { setSelectedFile, setActiveFolder } = useFileTreeStore();
  const { toggleSidebar, sidebarOpen } = useUIStore();
  const { createNote } = useNoteAPI();

  // Prevent double-click creating duplicate notes
  const isCreatingNote = useRef(false);

  // Get the active workspace
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // Get recent notes (last 5, sorted by update time)
  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  // Get the most recent note for "Continue writing"
  const continueNote = recentNotes[0];

  // Check if we have today's journal
  const now = new Date();
  const journalFilename = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const expectedJournalPath = `Journal/${journalFilename}.md`;
  const normalizedExpectedPath = normalizePath(expectedJournalPath);
  const todaysJournal = notes.find((note) => normalizePath(note.filePath) === normalizedExpectedPath);

  // Format today's date for journal title (e.g., "November 10, 2025")
  const journalTitle = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Stats
  const totalNotes = notes.length;
  const todayNotes = notes.filter((n) => {
    const noteDate = new Date(n.updatedAt);
    return noteDate.toDateString() === now.toDateString();
  }).length;

  const handleNoteClick = (noteId: string) => {
    logger.info('[HomePage] Note clicked', { noteId });

    // Find the note to get its file path and folder
    const note = notes.find((n) => n.id === noteId);
    logger.info('[HomePage] Found note', {
      note: note
        ? {
            id: note.id,
            title: note.title,
            filePath: note.filePath,
            workspaceId: note.workspaceId,
          }
        : null,
    });

    if (note) {
      // Set the selected file first - this will auto-expand parent folders
      if (note.filePath) {
        // Normalize the path to match FileTree's normalization
        const normalizedPath = note.filePath
          .replace(/\\/g, '/')
          .replace(/^\/+/, '')
          .replace(/\/+$/, '');
        logger.info('[HomePage] Setting selected file (will auto-expand folders)', {
          originalPath: note.filePath,
          normalizedPath,
        });
        setSelectedFile(normalizedPath);

        // Extract folder path from the file path (everything before the last /)
        const lastSlash = normalizedPath.lastIndexOf('/');
        if (lastSlash > 0) {
          const folderPath = normalizedPath.substring(0, lastSlash);
          logger.info('[HomePage] Setting active folder', { folderPath });
          setActiveFolder(folderPath);
        }
      }
    }

    // Set the active note - this will trigger the editor to show
    logger.info('[HomePage] Setting active note', { noteId });
    setActiveNote(noteId);
  };

  // Handle creating or opening today's journal
  const handleJournalClick = async () => {
    logger.info('[HomePage] Journal clicked', { journalFilename, journalTitle });

    // Check if today's journal already exists in Journal folder (by filename)
    // Use the same normalized path we computed earlier
    const existingJournal = todaysJournal;

    if (existingJournal) {
      // Open existing journal
      logger.info('[HomePage] Opening existing journal', { id: existingJournal.id });
      handleNoteClick(existingJournal.id);
    } else {
      // Prevent double-click
      if (isCreatingNote.current) {
        logger.info('[HomePage] Already creating note, ignoring click');
        return;
      }
      isCreatingNote.current = true;

      // Create new journal entry with ISO date as title (filename will be YYYY-MM-DD.md)
      logger.info('[HomePage] Creating new journal entry');
      try {
        const newNote = await createNote({
          title: journalFilename,
          content: `# ${journalTitle}\n\n`,
          folderPath: 'Journal',
        });

        if (newNote) {
          logger.info('[HomePage] Journal created', { id: newNote.id });
          handleNoteClick(newNote.id);
        }
      } finally {
        isCreatingNote.current = false;
      }
    }
  };

  // Handle creating a work note
  const handleWorkNoteClick = async () => {
    // Prevent double-click
    if (isCreatingNote.current) {
      logger.info('[HomePage] Already creating note, ignoring click');
      return;
    }
    isCreatingNote.current = true;

    logger.info('[HomePage] Work note clicked');
    try {
      const newNote = await createNote({
        title: 'Untitled',
        content: '',
        folderPath: 'Work',
      });

      if (newNote) {
        logger.info('[HomePage] Work note created', { id: newNote.id });
        handleNoteClick(newNote.id);
      }
    } finally {
      isCreatingNote.current = false;
    }
  };

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
                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
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
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-xs text-muted-foreground">{journalFilename}</div>
              </div>
              {!todaysJournal && (
                <Sparkles size={16} className="text-primary" />
              )}
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
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
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
              <p className="text-sm text-muted-foreground">
                Create your first note to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
