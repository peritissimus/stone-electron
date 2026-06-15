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

export const DOMAIN_EVENT_TYPES = {
  NOTE_CREATED: 'note:created',
  NOTE_UPDATED: 'note:updated',
  NOTE_DELETED: 'note:deleted',
  NOTE_MOVED: 'note:moved',
  NOTEBOOK_CREATED: 'notebook:created',
  NOTEBOOK_UPDATED: 'notebook:updated',
  NOTEBOOK_DELETED: 'notebook:deleted',
  TAG_CREATED: 'tag:created',
  TAG_UPDATED: 'tag:updated',
  TAG_DELETED: 'tag:deleted',
  NOTE_TAGGED: 'note:tagged',
  NOTE_UNTAGGED: 'note:untagged',
  WORKSPACE_CREATED: 'workspace:created',
  WORKSPACE_UPDATED: 'workspace:updated',
  WORKSPACE_DELETED: 'workspace:deleted',
  WORKSPACE_ACTIVATED: 'workspace:activated',
  FILE_SYNCED: 'file:synced',
  TOPIC_CREATED: 'topic:created',
  TOPIC_UPDATED: 'topic:updated',
  TOPIC_DELETED: 'topic:deleted',
  NOTE_CLASSIFIED: 'note:classified',
  EMBEDDING_PROGRESS: 'embedding:progress',
  DB_VACUUM_PROGRESS: 'db:vacuum:progress',
  DB_VACUUM_COMPLETE: 'db:vacuum:complete',
  SETTINGS_CHANGED: 'settings:changed',
} as const;

export interface NoteCreatedEvent extends DomainEvent {
  type: 'note:created';
  payload:
    | {
        id: string;
        /** ISO date string when the created note is a journal entry for that day. */
        journalDate?: string;
      }
    | {
        id: string;
        title: string;
        workspaceId: string | null;
        notebookId: string | null;
        filePath: string | null;
        journalDate?: string;
      };
}

export interface NoteUpdatedEvent extends DomainEvent {
  type: 'note:updated';
  payload:
    | {
        id: string;
        journalDate?: string;
      }
    | {
        id: string;
        title: string;
        changes: string[];
        journalDate?: string;
      };
}

export interface NoteDeletedEvent extends DomainEvent {
  type: 'note:deleted';
  payload:
    | {
        id: string;
      }
    | {
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
  payload:
    | {
        notebook: unknown;
      }
    | {
        id: string;
        name: string;
        workspaceId: string | null;
        parentId: string | null;
      };
}

export interface NotebookUpdatedEvent extends DomainEvent {
  type: 'notebook:updated';
  payload:
    | {
        notebook: unknown;
      }
    | {
        id: string;
        name: string;
        changes: string[];
      };
}

export interface NotebookDeletedEvent extends DomainEvent {
  type: 'notebook:deleted';
  payload: {
    id: string;
    name?: string;
  };
}

export interface TagCreatedEvent extends DomainEvent {
  type: 'tag:created';
  payload: {
    tag: unknown;
  };
}

export interface TagUpdatedEvent extends DomainEvent {
  type: 'tag:updated';
  payload: {
    tag: unknown;
  };
}

export interface TagDeletedEvent extends DomainEvent {
  type: 'tag:deleted';
  payload: {
    id: string;
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

export interface WorkspaceCreatedEvent extends DomainEvent {
  type: 'workspace:created';
  payload: {
    workspace: unknown;
  };
}

export interface WorkspaceUpdatedEvent extends DomainEvent {
  type: 'workspace:updated';
  payload: {
    workspace: unknown;
  };
}

export interface WorkspaceDeletedEvent extends DomainEvent {
  type: 'workspace:deleted';
  payload: {
    id: string;
  };
}

export interface WorkspaceActivatedEvent extends DomainEvent {
  type: 'workspace:activated';
  payload:
    | {
        id: string;
        name: string;
        folderPath: string;
      }
    | {
        workspace: unknown;
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
  payload:
    | {
        topic: unknown;
      }
    | {
        id: string;
        name: string;
      };
}

export interface TopicUpdatedEvent extends DomainEvent {
  type: 'topic:updated';
  payload:
    | {
        topic: unknown;
      }
    | {
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
  payload:
    | {
        noteId: string;
        topics: Array<{ topicId: string; topicName: string; confidence: number }>;
      }
    | {
        noteId: string;
        topicId: string;
        confidence: number;
        isManual?: boolean;
      }
    | {
        noteId: string;
        topicId: string | null;
        removed: true;
      };
}

export interface EmbeddingProgressEvent extends DomainEvent {
  type: 'embedding:progress';
  payload:
    | {
        processed: number;
        total: number;
        failed: number;
      }
    | {
        current: number;
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

// Settings events
export type SettingsScope =
  | 'appearance'
  | 'editor'
  | 'shortcuts'
  | 'workspace'
  | 'ai'
  | 'meetings'
  | 'onboarding'
  | 'quickCapture'
  | 'integrations';

export interface SettingsChangedEvent extends DomainEvent {
  type: 'settings:changed';
  payload: { scope: SettingsScope };
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
  | TagUpdatedEvent
  | TagDeletedEvent
  | NoteTaggedEvent
  | NoteUntaggedEvent
  | WorkspaceCreatedEvent
  | WorkspaceUpdatedEvent
  | WorkspaceDeletedEvent
  | WorkspaceActivatedEvent
  | FileSyncedEvent
  | TopicCreatedEvent
  | TopicUpdatedEvent
  | TopicDeletedEvent
  | NoteClassifiedEvent
  | EmbeddingProgressEvent
  | DbVacuumProgressEvent
  | DbVacuumCompleteEvent
  | SettingsChangedEvent;

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
   * Subscribe to events of a specific type
   */
  subscribe<T extends AppDomainEvent>(eventType: T['type'], handler: EventHandler<T>): () => void;

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler<AppDomainEvent>): () => void;
}
