import { EVENTS } from '../../../../shared/constants/ipcChannels';
import type { AppDomainEvent } from '../../../domain';

/**
 * Which domain events reach the renderer, and on which channel.
 *
 * Shared by both outbound transports — Electron's `webContents.send` and the
 * server's SSE stream — so a browser client sees exactly the events a desktop
 * window does.
 */
export const DOMAIN_TO_IPC_EVENT: Partial<Record<AppDomainEvent['type'], string>> = {
  'note:created': EVENTS.NOTE_CREATED,
  'note:updated': EVENTS.NOTE_UPDATED,
  'note:deleted': EVENTS.NOTE_DELETED,
  'notebook:created': EVENTS.NOTEBOOK_CREATED,
  'notebook:updated': EVENTS.NOTEBOOK_UPDATED,
  'notebook:deleted': EVENTS.NOTEBOOK_DELETED,
  'tag:created': EVENTS.TAG_CREATED,
  'tag:deleted': EVENTS.TAG_DELETED,
  'workspace:created': EVENTS.WORKSPACE_CREATED,
  'workspace:updated': EVENTS.WORKSPACE_UPDATED,
  'workspace:deleted': EVENTS.WORKSPACE_DELETED,
  'workspace:activated': EVENTS.WORKSPACE_SWITCHED,
  'file:synced': EVENTS.FILE_SYNCED,
  'topic:created': EVENTS.TOPIC_CREATED,
  'topic:updated': EVENTS.TOPIC_UPDATED,
  'topic:deleted': EVENTS.TOPIC_DELETED,
  'note:classified': EVENTS.NOTE_CLASSIFIED,
  'embedding:progress': EVENTS.EMBEDDING_PROGRESS,
  'db:vacuum:progress': EVENTS.DB_VACUUM_PROGRESS,
  'db:vacuum:complete': EVENTS.DB_VACUUM_COMPLETE,
  'settings:changed': EVENTS.SETTINGS_CHANGED,
  'meeting:statusChanged': EVENTS.MEETING_STATUS_CHANGED,
};
