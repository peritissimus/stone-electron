import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Plus, CaretRight } from 'phosphor-react';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useTopicsData } from '@renderer/hooks/useTopicsData';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { Input } from '@renderer/components/base/ui/input';
import { Button } from '@renderer/components/base/ui/button';
import { Checkbox } from '@renderer/components/base/ui/checkbox';
import { Label } from '@renderer/components/base/ui/label';
import { cn } from '@renderer/lib/utils';
import { TopicRow } from './TopicRow';
import { NoteRow } from './NoteRow';
import { ReclassifyPopover } from './ReclassifyPopover';
import { TopicNotesPanel } from './TopicNotesPanel';
import { CreateTopicDialog } from './CreateTopicDialog';

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
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
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

      <div className="flex-1 flex overflow-hidden">
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
