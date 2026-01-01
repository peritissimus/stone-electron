/**
 * TopicsPage - Premium topic-based note organization
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Hash,
  Search,
  Plus,
  Sparkles,
  ChevronRight,
  X,
  FileText,
  Zap,
  Circle,
  RotateCw,
} from 'lucide-react';
import { CaretRight } from 'phosphor-react';
import { useTopicStore } from '@renderer/stores/topicStore';
import { useTopicAPI } from '@renderer/hooks/useTopicAPI';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useUIStore } from '@renderer/stores/uiStore';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/base/ui/dialog';
import { cn } from '@renderer/lib/utils';
import type { TopicWithCount } from '@shared/types';

// Refined color system
const TOPIC_STYLES: Record<string, { bg: string; text: string; icon: string; ring: string }> = {
  '#3b82f6': {
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    icon: 'text-blue-500',
    ring: 'ring-blue-500/30',
  },
  '#10b981': {
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: 'text-emerald-500',
    ring: 'ring-emerald-500/30',
  },
  '#8b5cf6': {
    bg: 'bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20',
    text: 'text-violet-700 dark:text-violet-300',
    icon: 'text-violet-500',
    ring: 'ring-violet-500/30',
  },
  '#f59e0b': {
    bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-500',
    ring: 'ring-amber-500/30',
  },
  '#ec4899': {
    bg: 'bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-950/40 dark:to-pink-900/20',
    text: 'text-pink-700 dark:text-pink-300',
    icon: 'text-pink-500',
    ring: 'ring-pink-500/30',
  },
  '#6366f1': {
    bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    icon: 'text-indigo-500',
    ring: 'ring-indigo-500/30',
  },
};

const COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Blue', class: 'bg-blue-500' },
  { value: '#10b981', label: 'Emerald', class: 'bg-emerald-500' },
  { value: '#8b5cf6', label: 'Violet', class: 'bg-violet-500' },
  { value: '#f59e0b', label: 'Amber', class: 'bg-amber-500' },
  { value: '#ec4899', label: 'Pink', class: 'bg-pink-500' },
  { value: '#6366f1', label: 'Indigo', class: 'bg-indigo-500' },
];

interface TopicNote {
  id: string;
  title: string;
  confidence?: number;
  isManual?: boolean;
}

function TopicCard({
  topic,
  onClick,
  isSelected,
}: {
  topic: TopicWithCount;
  onClick: () => void;
  isSelected: boolean;
}) {
  const style = TOPIC_STYLES[topic.color || '#6366f1'] || TOPIC_STYLES['#6366f1'];

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full text-left',
        'p-5 rounded-2xl border border-border/50',
        'transition-all duration-300 ease-out',
        'hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20',
        'hover:-translate-y-0.5',
        style.bg,
        isSelected && 'ring-2 ring-offset-2 ring-offset-background ' + style.ring,
      )}
    >
      {/* Topic Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center mb-4',
          'bg-white/60 dark:bg-white/10 backdrop-blur-sm',
          'shadow-sm',
        )}
      >
        <Hash className={cn('w-5 h-5', style.icon)} />
      </div>

      {/* Topic Name */}
      <h3 className={cn('font-semibold text-[15px] mb-1', style.text)}>{topic.name}</h3>

      {/* Description */}
      {topic.description && (
        <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-3 leading-relaxed">
          {topic.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-xs font-medium text-muted-foreground">
          {topic.noteCount || 0} {topic.noteCount === 1 ? 'note' : 'notes'}
        </span>
        {topic.isPredefined && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-muted-foreground">
            System
          </span>
        )}
      </div>

      {/* Hover Arrow */}
      <ChevronRight
        className={cn(
          'absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5',
          'text-muted-foreground/30 opacity-0 -translate-x-2',
          'group-hover:opacity-100 group-hover:translate-x-0',
          'transition-all duration-300',
        )}
      />
    </button>
  );
}

function NoteItem({ note, onClick }: { note: TopicNote; onClick: () => void }) {
  const confidence = note.confidence ? Math.round(note.confidence * 100) : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3',
        'hover:bg-accent/50 transition-colors duration-150',
        'group text-left border-b border-border/50 last:border-0',
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{note.title || 'Untitled'}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {confidence !== null && (
            <span className="text-[11px] text-muted-foreground">{confidence}% match</span>
          )}
          {note.isManual && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              Manual
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function SearchResultItem({
  result,
  onClick,
}: {
  result: { noteId: string; title: string; distance: number };
  onClick: () => void;
}) {
  const similarity = Math.round((1 - result.distance) * 100);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3',
        'hover:bg-accent/50 transition-colors duration-150',
        'group text-left border-b border-border/50 last:border-0',
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{result.title}</p>
        <span className="text-[11px] text-muted-foreground">{similarity}% semantic match</span>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function StatusCard({
  embeddingStatus,
}: {
  embeddingStatus: { ready: boolean; totalNotes: number; embeddedNotes: number; pendingNotes: number } | null;
}) {
  if (!embeddingStatus) return null;

  const progress =
    embeddingStatus.totalNotes > 0
      ? Math.round((embeddingStatus.embeddedNotes / embeddingStatus.totalNotes) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            embeddingStatus.ready
              ? 'bg-emerald-100 dark:bg-emerald-900/30'
              : 'bg-amber-100 dark:bg-amber-900/30',
          )}
        >
          <Zap
            className={cn(
              'w-5 h-5',
              embeddingStatus.ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
            )}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold">AI Classification</h3>
          <p className="text-xs text-muted-foreground">
            {embeddingStatus.ready ? 'Model ready' : 'Not initialized'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{embeddingStatus.embeddedNotes} classified</span>
          <span>{embeddingStatus.pendingNotes} pending</span>
        </div>
      </div>
    </div>
  );
}

export function TopicsPage() {
  const { toggleSidebar, sidebarOpen } = useUIStore();
  const { setActiveNote } = useNoteStore();
  const {
    topics,
    selectedTopicId,
    embeddingStatus,
    searchResults,
    searchQuery,
    loading,
    classifying,
    error,
    selectTopic,
    setSearchQuery,
  } = useTopicStore();

  const {
    initialize,
    loadTopics,
    createTopic,
    semanticSearch,
    classifyAllNotes,
    reclassifyAllNotes,
    getEmbeddingStatus,
    getNotesForTopic,
  } = useTopicAPI();

  const [searchInput, setSearchInput] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [topicNotes, setTopicNotes] = useState<TopicNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Create topic dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [newTopicColor, setNewTopicColor] = useState('#6366f1');
  const [creating, setCreating] = useState(false);

  // Load topics and embedding status on mount
  useEffect(() => {
    const init = async () => {
      setInitializing(true);
      await loadTopics();
      await getEmbeddingStatus();
      setInitializing(false);
    };
    init();
  }, [loadTopics, getEmbeddingStatus]);

  // Load notes when a topic is selected
  useEffect(() => {
    if (selectedTopicId) {
      setLoadingNotes(true);
      getNotesForTopic(selectedTopicId)
        .then((notes) => {
          setTopicNotes(notes as TopicNote[]);
        })
        .finally(() => setLoadingNotes(false));
    } else {
      setTopicNotes([]);
    }
  }, [selectedTopicId, getNotesForTopic]);

  // Handle semantic search with debounce
  useEffect(() => {
    if (!searchInput.trim()) {
      setSearchQuery('');
      return;
    }

    const timeoutId = setTimeout(() => {
      semanticSearch(searchInput);
      setSearchQuery(searchInput);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput, semanticSearch, setSearchQuery]);

  const handleTopicClick = useCallback(
    (topic: TopicWithCount) => {
      selectTopic(topic.id === selectedTopicId ? null : topic.id);
    },
    [selectTopic, selectedTopicId],
  );

  const handleNoteClick = useCallback(
    (noteId: string) => {
      setActiveNote(noteId);
    },
    [setActiveNote],
  );

  const handleSearchResultClick = useCallback(
    (noteId: string) => {
      setActiveNote(noteId);
    },
    [setActiveNote],
  );

  const handleClassifyAll = useCallback(async () => {
    const ready = await initialize();
    if (ready) {
      await classifyAllNotes();
      await getEmbeddingStatus();
      await loadTopics();
    }
  }, [initialize, classifyAllNotes, getEmbeddingStatus, loadTopics]);

  const handleReclassifyAll = useCallback(async () => {
    const ready = await initialize();
    if (ready) {
      await reclassifyAllNotes();
      await getEmbeddingStatus();
      await loadTopics();
    }
  }, [initialize, reclassifyAllNotes, getEmbeddingStatus, loadTopics]);

  const handleRefresh = useCallback(async () => {
    await loadTopics();
    await getEmbeddingStatus();
  }, [loadTopics, getEmbeddingStatus]);

  const handleCreateTopic = useCallback(async () => {
    if (!newTopicName.trim()) return;

    setCreating(true);
    try {
      await createTopic({
        name: newTopicName.trim(),
        description: newTopicDescription.trim() || undefined,
        color: newTopicColor,
      });
      setShowCreateDialog(false);
      setNewTopicName('');
      setNewTopicDescription('');
      setNewTopicColor('#6366f1');
      await loadTopics();
    } finally {
      setCreating(false);
    }
  }, [newTopicName, newTopicDescription, newTopicColor, createTopic, loadTopics]);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);
  const pendingNotes = embeddingStatus?.pendingNotes || 0;

  // Loading state
  if (initializing) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div
          className={cn(
            'px-6 border-b border-border/50 shrink-0 flex items-center gap-3',
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
          <Hash className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Topics</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading topics...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div
        className={cn(
          'px-6 border-b border-border/50 shrink-0 flex items-center gap-3',
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
        <Hash className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Topics</span>
        <div className="flex-1" />

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 px-3 text-xs"
          >
            <RotateCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          {pendingNotes > 0 && (
            <Button size="sm" onClick={handleClassifyAll} disabled={classifying} className="h-8 px-3 text-xs">
              <Sparkles className={cn('w-3.5 h-3.5 mr-1.5', classifying && 'animate-pulse')} />
              {classifying ? 'Processing...' : `Classify ${pendingNotes}`}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div
          className={cn(
            'overflow-auto transition-all duration-300',
            selectedTopicId ? 'w-1/2 border-r border-border/50' : 'w-full',
          )}
        >
          {/* Hero Section */}
          <div className="px-8 pt-8 pb-6">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Topics</h1>
            <p className="text-muted-foreground text-sm max-w-lg">
              Organize your notes with AI-powered topic classification. Click a topic to view its notes,
              or use semantic search to find related content.
            </p>
          </div>

          {/* Search & Actions */}
          <div className="px-8 pb-6 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by meaning..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)} className="h-10 px-4">
              <Plus className="w-4 h-4 mr-2" />
              New Topic
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReclassifyAll}
              disabled={classifying || (embeddingStatus?.totalNotes || 0) === 0}
              className="h-10 px-4"
            >
              <RotateCw className={cn('w-4 h-4 mr-2', classifying && 'animate-spin')} />
              Reclassify All
            </Button>
          </div>

          <div className="px-8 pb-8">
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Search Results */}
            {searchQuery && searchResults.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Semantic Results for "{searchQuery}"
                </h2>
                <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                  {searchResults.map((result) => (
                    <SearchResultItem
                      key={result.noteId}
                      result={result}
                      onClick={() => handleSearchResultClick(result.noteId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !loading && (
              <div className="mb-8 text-center py-12 rounded-xl border border-dashed border-border/50">
                <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No notes found matching "{searchQuery}"</p>
              </div>
            )}

            {/* Topics Grid */}
            {!searchQuery && (
              <>
                {topics.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <Hash className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">No topics yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create a topic or run classification to get started
                    </p>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Topic
                    </Button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'grid gap-4',
                      selectedTopicId
                        ? 'grid-cols-1 xl:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                    )}
                  >
                    {topics.map((topic) => (
                      <TopicCard
                        key={topic.id}
                        topic={topic}
                        onClick={() => handleTopicClick(topic)}
                        isSelected={topic.id === selectedTopicId}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Status Card */}
            {!selectedTopicId && !searchQuery && topics.length > 0 && (
              <div className="mt-8 max-w-sm">
                <StatusCard embeddingStatus={embeddingStatus} />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Notes List */}
        {selectedTopicId && selectedTopic && (
          <div className="w-1/2 flex flex-col overflow-hidden bg-muted/20">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3 bg-card/50">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${selectedTopic.color}20` }}
              >
                <Hash className="w-4 h-4" style={{ color: selectedTopic.color || '#6366f1' }} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-sm">{selectedTopic.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {topicNotes.length} {topicNotes.length === 1 ? 'note' : 'notes'}
                </p>
              </div>
              <IconButton size="normal" icon={<X size={16} />} tooltip="Close" onClick={() => selectTopic(null)} />
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-auto p-4">
              {loadingNotes ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : topicNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground">No notes in this topic yet</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                  {topicNotes.map((note) => (
                    <NoteItem key={note.id} note={note} onClick={() => handleNoteClick(note.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Topic Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name</label>
              <Input
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="e.g., Research, Meetings, Ideas"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Input
                value={newTopicDescription}
                onChange={(e) => setNewTopicDescription(e.target.value)}
                placeholder="Brief description (optional)"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-3 block">Color</label>
              <div className="flex gap-3">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNewTopicColor(color.value)}
                    className={cn(
                      'w-9 h-9 rounded-xl transition-all duration-200',
                      color.class,
                      newTopicColor === color.value
                        ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                        : 'hover:scale-105 opacity-70 hover:opacity-100',
                    )}
                    title={color.label}
                  >
                    {newTopicColor === color.value && (
                      <Circle className="w-3 h-3 mx-auto text-white fill-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTopic} disabled={!newTopicName.trim() || creating}>
              {creating ? 'Creating...' : 'Create Topic'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
