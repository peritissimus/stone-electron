import React from 'react';
import { Clock, FileText, Star, Pin, Archive, TrendingUp, FolderOpen, Hash } from 'lucide-react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useTagStore } from '@renderer/stores/tagStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { cn } from '@renderer/lib/utils';
import { logger } from '@renderer/utils/logger';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  onClick?: () => void;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, onClick, className }) => (
  <div
    className={cn(
      'flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors',
      onClick && 'cursor-pointer hover:border-primary/30',
      className
    )}
    onClick={onClick}
  >
    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  </div>
);

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
  const { tags } = useTagStore();
  const { tree, setSelectedFile, setActiveFolder } = useFileTreeStore();

  // Get the active workspace
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  // Calculate statistics
  const totalNotes = notes.length;
  const favoriteNotes = notes.filter(n => n.isFavorite).length;
  const pinnedNotes = notes.filter(n => n.isPinned).length;
  const archivedNotes = notes.filter(n => n.isArchived).length;
  const totalTags = tags.length;

  // Count total folders
  const countFolders = (nodes: any[]): number => {
    let count = 0;
    nodes.forEach(node => {
      if (node.type === 'folder') {
        count++;
        if (node.children) {
          count += countFolders(node.children);
        }
      }
    });
    return count;
  };
  const totalFolders = countFolders(tree);

  // Get recent notes (last 10, sorted by update time)
  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  // Get current date and greeting
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border bg-background">
        <h1 className="text-3xl font-bold mb-1">{greeting}!</h1>
        <p className="text-muted-foreground">{dateString}</p>
        {activeWorkspace && (
          <p className="text-sm text-muted-foreground mt-2">
            Workspace: <span className="font-medium">{activeWorkspace.name}</span>
          </p>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          {/* Statistics Grid */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<FileText className="w-5 h-5" />}
                label="Total Notes"
                value={totalNotes}
              />
              <StatCard
                icon={<Star className="w-5 h-5" />}
                label="Favorites"
                value={favoriteNotes}
              />
              <StatCard
                icon={<Pin className="w-5 h-5" />}
                label="Pinned"
                value={pinnedNotes}
              />
              <StatCard
                icon={<Archive className="w-5 h-5" />}
                label="Archived"
                value={archivedNotes}
              />
              <StatCard
                icon={<FolderOpen className="w-5 h-5" />}
                label="Folders"
                value={totalFolders}
              />
              <StatCard
                icon={<Hash className="w-5 h-5" />}
                label="Tags"
                value={totalTags}
              />
            </div>
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
          {totalNotes === 0 && (
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