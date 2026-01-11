/**
 * TopicsPage - Minimal topic-based note organization
 */

import { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Plus, CaretRight, X, FileText, ArrowsClockwise } from 'phosphor-react';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useTopicsData } from '@renderer/hooks/useTopicsData';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { Checkbox } from '@renderer/components/base/ui/checkbox';
import { Label } from '@renderer/components/base/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/base/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/base/ui/popover';
import { cn } from '@renderer/lib/utils';
import type { TopicWithCount } from '@shared/types';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1'];

interface TopicNote {
  id: string;
  title: string;
  confidence?: number;
  isManual?: boolean;
}

const TopicRow = memo(function TopicRow({
  topic,
  onClick,
  isSelected,
}: {
  topic: TopicWithCount;
  onClick: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left',
        'border-b border-border/40 last:border-0',
        'hover:bg-muted/50 transition-colors',
        isSelected && 'bg-muted/70',
      )}
    >
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: topic.color || '#6366f1' }}
      />
      <span className="flex-1 text-sm font-medium truncate">{topic.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{topic.noteCount || 0}</span>
      <CaretRight size={16} className="text-muted-foreground/50" />
    </button>
  );
});

const NoteRow = memo(function NoteRow({ note, onClick }: { note: TopicNote; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left',
        'border-b border-border/40 last:border-0',
        'hover:bg-muted/50 transition-colors',
      )}
    >
      <FileText className="w-4 h-4 text-muted-foreground/60 shrink-0" />
      <span className="flex-1 text-sm truncate">{note.title || 'Untitled'}</span>
      {note.confidence && (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {Math.round(note.confidence * 100)}%
        </span>
      )}
    </button>
  );
});

export function TopicsPage() {
  const navigate = useNavigate();
  const { toggleSidebar, sidebarOpen } = useSidebarUI();

  const {
    topics,
    selectedTopicId,
    selectedTopic,
    topicNotes,
    embeddingStatus,
    searchResults,
    searchQuery,
    searchInput,
    classifying,
    error,
    initializing,
    loadingNotes,
    excludeJournal,
    setSearchInput,
    setExcludeJournal,
    handleTopicClick,
    handleReclassify,
    handleCreateTopic,
    selectTopic,
  } = useTopicsData();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicColor, setNewTopicColor] = useState('#6366f1');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!newTopicName.trim()) return;
    setCreating(true);
    try {
      await handleCreateTopic(newTopicName, newTopicColor);
      setShowCreateDialog(false);
      setNewTopicName('');
    } finally {
      setCreating(false);
    }
  }, [newTopicName, newTopicColor, handleCreateTopic]);

  if (initializing) {
    return (
      <div className="flex flex-col h-full">
        <TopicsHeader sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={cn(
          'px-4 border-b border-border/50 flex items-center gap-2',
          sizeHeightClasses['spacious'],
        )}
      >
        {!sidebarOpen && (
          <IconButton
            size="normal"
            icon={<CaretRight size={16} weight="bold" />}
            tooltip="Expand"
            onClick={toggleSidebar}
          />
        )}
        <span className="text-sm font-medium">Topics</span>
        <div className="flex-1" />
        <ReclassifyPopover
          excludeJournal={excludeJournal}
          setExcludeJournal={setExcludeJournal}
          classifying={classifying}
          onReclassify={handleReclassify}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="h-7 px-2 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border/50 space-y-2">
        <div className="relative">
          <MagnifyingGlass
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-8 pl-8 text-sm bg-muted/30 border-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="exclude-journal-listing"
            checked={excludeJournal}
            onCheckedChange={(checked) => setExcludeJournal(checked === true)}
          />
          <Label
            htmlFor="exclude-journal-listing"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Exclude journals
          </Label>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Topics List */}
        <div
          className={cn(
            'overflow-auto',
            selectedTopicId ? 'w-1/2 border-r border-border/50' : 'w-full',
          )}
        >
          {error && <div className="px-4 py-2 text-xs text-destructive">{error}</div>}

          {searchQuery && searchResults.length > 0 && (
            <div className="border-b border-border/50">
              <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Results
              </div>
              {searchResults.map((r) => (
                <NoteRow
                  key={r.noteId}
                  note={{ id: r.noteId, title: r.title, confidence: 1 - r.distance }}
                  onClick={() => navigate(`/note/${r.noteId}`)}
                />
              ))}
            </div>
          )}

          {!searchQuery && topics.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">No topics</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="mt-1"
              >
                Create one
              </Button>
            </div>
          )}

          {!searchQuery && topics.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {topics.length} Topics
              </div>
              {topics.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  onClick={() => handleTopicClick(topic.id)}
                  isSelected={topic.id === selectedTopicId}
                />
              ))}
            </div>
          )}

          {/* Status */}
          {!searchQuery && embeddingStatus && (
            <div className="px-4 py-3 border-t border-border/50 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>{embeddingStatus.ready ? 'Ready' : 'Not initialized'}</span>
                <span>
                  {embeddingStatus.embeddedNotes}/{embeddingStatus.totalNotes} classified
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Notes Panel */}
        {selectedTopicId && selectedTopic && (
          <TopicNotesPanel
            topic={selectedTopic}
            notes={topicNotes}
            loading={loadingNotes}
            onNoteClick={(id) => navigate(`/note/${id}`)}
            onClose={() => selectTopic(null)}
          />
        )}
      </div>

      {/* Create Dialog */}
      <CreateTopicDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        name={newTopicName}
        setName={setNewTopicName}
        color={newTopicColor}
        setColor={setNewTopicColor}
        creating={creating}
        onCreate={handleCreate}
      />
    </div>
  );
}

// Sub-components

function TopicsHeader({
  sidebarOpen,
  toggleSidebar,
}: {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}) {
  return (
    <div
      className={cn(
        'px-4 border-b border-border/50 flex items-center gap-2',
        sizeHeightClasses['spacious'],
      )}
    >
      {!sidebarOpen && (
        <IconButton
          size="normal"
          icon={<CaretRight size={16} weight="bold" />}
          tooltip="Expand"
          onClick={toggleSidebar}
        />
      )}
      <span className="text-sm font-medium">Topics</span>
    </div>
  );
}

function ReclassifyPopover({
  excludeJournal,
  setExcludeJournal,
  classifying,
  onReclassify,
}: {
  excludeJournal: boolean;
  setExcludeJournal: (v: boolean) => void;
  classifying: boolean;
  onReclassify: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={classifying}
          className="h-7 px-2 text-xs"
          title="Reclassify options"
        >
          <ArrowsClockwise size={14} className={cn(classifying && 'animate-spin')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="space-y-3">
          <div className="text-sm font-medium">Reclassify Options</div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="exclude-journal"
              checked={excludeJournal}
              onCheckedChange={(checked) => setExcludeJournal(checked === true)}
            />
            <Label htmlFor="exclude-journal" className="text-xs cursor-pointer">
              Exclude Journal notes
            </Label>
          </div>
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={onReclassify}
            disabled={classifying}
          >
            {classifying ? 'Reclassifying...' : 'Reclassify All'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TopicNotesPanel({
  topic,
  notes,
  loading,
  onNoteClick,
  onClose,
}: {
  topic: TopicWithCount;
  notes: TopicNote[];
  loading: boolean;
  onNoteClick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-1/2 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: topic.color || '#6366f1' }}
        />
        <span className="text-sm font-medium flex-1">{topic.name}</span>
        <span className="text-xs text-muted-foreground">{notes.length}</span>
        <IconButton size="normal" icon={<X size={14} />} tooltip="Close" onClick={onClose} />
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No notes
          </div>
        ) : (
          notes.map((note) => (
            <NoteRow key={note.id} note={note} onClick={() => onNoteClick(note.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function CreateTopicDialog({
  open,
  onOpenChange,
  name,
  setName,
  color,
  setColor,
  creating,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  setName: (name: string) => void;
  color: string;
  setColor: (color: string) => void;
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">New Topic</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Topic name"
            className="h-9"
            autoFocus
          />
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  'w-6 h-6 rounded-full transition-transform',
                  color === c
                    ? 'scale-125 ring-2 ring-offset-2 ring-offset-background ring-foreground/20'
                    : 'hover:scale-110',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={onCreate} disabled={!name.trim() || creating}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
