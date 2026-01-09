/**
 * Event Publisher Port (Outbound)
 *
 * Defines the contract for publishing domain events.
 * Implementations can be in-process event bus, message queue, etc.
 */

// Domain Events
export interface DomainEvent {
  type: string;
  timestamp: Date;
  payload: unknown;
}

export interface NoteCreatedEvent extends DomainEvent {
  type: 'note:created';
  payload: {
    id: string;
    title: string;
    workspaceId: string | null;
    notebookId: string | null;
    filePath: string | null;
  };
}

export interface NoteUpdatedEvent extends DomainEvent {
  type: 'note:updated';
  payload: {
    id: string;
    title: string;
    changes: string[];
  };
}

export interface NoteDeletedEvent extends DomainEvent {
  type: 'note:deleted';
  payload: {
    id: string;
    title: string;
    permanent: boolean;
  };
}

export interface NoteMovedEvent extends DomainEvent {
  type: 'note:moved';
  payload: {
    id: string;
    fromNotebookId: string | null;
    toNotebookId: string | null;
  };
}

export interface NotebookCreatedEvent extends DomainEvent {
  type: 'notebook:created';
  payload: {
    id: string;
    name: string;
    workspaceId: string | null;
    parentId: string | null;
  };
}

export interface NotebookUpdatedEvent extends DomainEvent {
  type: 'notebook:updated';
  payload: {
    id: string;
    name: string;
    changes: string[];
  };
}

export interface NotebookDeletedEvent extends DomainEvent {
  type: 'notebook:deleted';
  payload: {
    id: string;
    name: string;
  };
}

export interface TagCreatedEvent extends DomainEvent {
  type: 'tag:created';
  payload: {
    id: string;
    name: string;
  };
}

export interface TagDeletedEvent extends DomainEvent {
  type: 'tag:deleted';
  payload: {
    id: string;
    name: string;
  };
}

export interface NoteTaggedEvent extends DomainEvent {
  type: 'note:tagged';
  payload: {
    noteId: string;
    tagId: string;
    tagName: string;
  };
}

export interface NoteUntaggedEvent extends DomainEvent {
  type: 'note:untagged';
  payload: {
    noteId: string;
    tagId: string;
    tagName: string;
  };
}

export interface WorkspaceActivatedEvent extends DomainEvent {
  type: 'workspace:activated';
  payload: {
    id: string;
    name: string;
    folderPath: string;
  };
}

export interface FileSyncedEvent extends DomainEvent {
  type: 'file:synced';
  payload: {
    filePath: string;
    operation: 'created' | 'updated' | 'deleted';
  };
}

// Topic events
export interface TopicCreatedEvent extends DomainEvent {
  type: 'topic:created';
  payload: {
    id: string;
    name: string;
  };
}

export interface TopicUpdatedEvent extends DomainEvent {
  type: 'topic:updated';
  payload: {
    id: string;
    name: string;
  };
}

export interface TopicDeletedEvent extends DomainEvent {
  type: 'topic:deleted';
  payload: {
    id: string;
  };
}

export interface NoteClassifiedEvent extends DomainEvent {
  type: 'note:classified';
  payload: {
    noteId: string;
    topics: Array<{ topicId: string; topicName: string; confidence: number }>;
  };
}

export interface EmbeddingProgressEvent extends DomainEvent {
  type: 'embedding:progress';
  payload: {
    processed: number;
    total: number;
    failed: number;
  };
}

// Database events
export interface DbVacuumProgressEvent extends DomainEvent {
  type: 'db:vacuum:progress';
  payload: Record<string, never>;
}

export interface DbVacuumCompleteEvent extends DomainEvent {
  type: 'db:vacuum:complete';
  payload: Record<string, never>;
}

export type AppDomainEvent =
  | NoteCreatedEvent
  | NoteUpdatedEvent
  | NoteDeletedEvent
  | NoteMovedEvent
  | NotebookCreatedEvent
  | NotebookUpdatedEvent
  | NotebookDeletedEvent
  | TagCreatedEvent
  | TagDeletedEvent
  | NoteTaggedEvent
  | NoteUntaggedEvent
  | WorkspaceActivatedEvent
  | FileSyncedEvent
  | TopicCreatedEvent
  | TopicUpdatedEvent
  | TopicDeletedEvent
  | NoteClassifiedEvent
  | EmbeddingProgressEvent
  | DbVacuumProgressEvent
  | DbVacuumCompleteEvent;

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>;

export interface IEventPublisher {
  /**
   * Publish a domain event
   */
  publish(event: AppDomainEvent): void;

  /**
   * Publish multiple events
   */
  publishAll(events: AppDomainEvent[]): void;

  /**
   * Emit a simple event using channel name from EVENTS constants
   */
  emit(channel: string, payload: unknown): void;

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T extends AppDomainEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): () => void;

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler<AppDomainEvent>): () => void;
}
