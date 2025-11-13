import React from 'react';
import { Clock, FileText, BookOpen, Briefcase, User, CheckSquare } from 'lucide-react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { logger } from '@renderer/utils/logger';
import { TodoList } from './TodoList';

interface RecentNoteProps {
  note: {
    id: string;
    title: string | null;
    updatedAt: Date;
    filePath: string | null;
  };
  onClick: (id: string) => void;
}

const RecentNote: React.FC<RecentNoteProps> = ({ note, onClick }) => {
  const formatDate = (date: Date) => {
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

  const folderPath = getFolderPath(note.filePath);

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/10 cursor-pointer transition-colors group"
      onClick={() => onClick(note.id)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate group-hover:text-primary transition-colors">
            {note.title || 'Untitled'}
          </p>
          {folderPath && (
            <p className="text-xs text-muted-foreground truncate">{folderPath}</p>
          )}
        </div>
      </div>
      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
        {formatDate(note.updatedAt)}
      </span>
    </div>
  );
};

export function HomePage() {
  const { notes, setActiveNote } = useNoteStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const { setSelectedFile, setActiveFolder } = useFileTreeStore();
  const { createNote } = useNoteAPI();

  // Get the active workspace
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  // Get recent notes (last 3, sorted by update time)
  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  // Get current date
  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Format today's date for journal title (e.g., "November 10, 2025")
  const journalTitle = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Format today's date for journal filename (e.g., "2025-11-10")
  const journalFilename = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const handleNoteClick = (noteId: string) => {
    logger.info('[HomePage] Note clicked', { noteId });

    // Find the note to get its file path and folder
    const note = notes.find(n => n.id === noteId);
    logger.info('[HomePage] Found note', {
      note: note ? {
        id: note.id,
        title: note.title,
        filePath: note.filePath,
        workspaceId: note.workspaceId
      } : null
    });

    if (note) {
      // Set the selected file first - this will auto-expand parent folders
      if (note.filePath) {
        // Normalize the path to match FileTree's normalization
        const normalizedPath = note.filePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
        logger.info('[HomePage] Setting selected file (will auto-expand folders)', {
          originalPath: note.filePath,
          normalizedPath
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
    const expectedFilePath = `Journal/${journalFilename}.md`;
    const existingJournal = notes.find(
      note => note.filePath === expectedFilePath
    );

    if (existingJournal) {
      // Open existing journal
      logger.info('[HomePage] Opening existing journal', { id: existingJournal.id });
      handleNoteClick(existingJournal.id);
    } else {
      // Create new journal entry with ISO date as title (filename will be YYYY-MM-DD.md)
      logger.info('[HomePage] Creating new journal entry');
      const newNote = await createNote({
        title: journalFilename,
        content: `# ${journalTitle}\n\n`,
        folderPath: 'Journal'
      });

      if (newNote) {
        logger.info('[HomePage] Journal created', { id: newNote.id });
        handleNoteClick(newNote.id);
      }
    }
  };

  // Handle creating a work note
  const handleWorkNoteClick = async () => {
    logger.info('[HomePage] Work note clicked');
    const newNote = await createNote({
      title: 'Untitled',
      content: '',
      folderPath: 'Work'
    });

    if (newNote) {
      logger.info('[HomePage] Work note created', { id: newNote.id });
      handleNoteClick(newNote.id);
    }
  };

  // Handle creating a personal note
  const handlePersonalNoteClick = async () => {
    logger.info('[HomePage] Personal note clicked');
    const newNote = await createNote({
      title: 'Untitled',
      content: '',
      folderPath: 'Personal'
    });

    if (newNote) {
      logger.info('[HomePage] Personal note created', { id: newNote.id });
      handleNoteClick(newNote.id);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border bg-background">
        <p className="text-muted-foreground mb-4">{dateString}</p>
        {activeWorkspace && (
          <p className="text-sm text-muted-foreground mb-6">
            Workspace: <span className="font-medium">{activeWorkspace.name}</span>
          </p>
        )}

        {/* Quick Action Shortcuts */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <button
            onClick={handleJournalClick}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/10 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <BookOpen className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-sm mb-1">Today's Journal</h3>
              <p className="text-xs text-muted-foreground">{journalTitle}</p>
            </div>
          </button>

          <button
            onClick={handleWorkNoteClick}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/10 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
              <Briefcase className="w-6 h-6 text-orange-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-sm mb-1">Work Note</h3>
              <p className="text-xs text-muted-foreground">Create new work note</p>
            </div>
          </button>

          <button
            onClick={handlePersonalNoteClick}
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-accent/10 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <User className="w-6 h-6 text-green-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-sm mb-1">Personal Note</h3>
              <p className="text-xs text-muted-foreground">Create new personal note</p>
            </div>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6 space-y-8">
          {/* Active Tasks */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Active Tasks
            </h2>
            <TodoList onTodoClick={handleNoteClick} />
          </div>

          {/* Recent Notes */}
          {recentNotes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Notes
              </h2>
              <div className="space-y-2">
                {recentNotes.map(note => (
                  <RecentNote
                    key={note.id}
                    note={{
                      id: note.id,
                      title: note.title,
                      updatedAt: note.updatedAt,
                      filePath: note.filePath
                    }}
                    onClick={handleNoteClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {notes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No notes yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Create your first note to get started. Your notes will appear here once you create them.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}