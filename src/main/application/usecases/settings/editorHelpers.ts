import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { EditorSettings } from '../../../domain/value-objects/AppConfig';

export function publishEditorChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'editor' },
  });
}

/**
 * Deep-merge a partial editor settings update on top of the current config.
 * Top-level slices (behavior, indent, table, task, codeBlock) are merged
 * shallowly so callers can update one field without overwriting siblings.
 * Within a slice, fields are spread the same way.
 */
export function mergeEditorPatch(current: EditorSettings, patch: Partial<EditorSettings>): EditorSettings {
  return {
    behavior: { ...current.behavior, ...(patch.behavior ?? {}) },
    indent: { ...current.indent, ...(patch.indent ?? {}) },
    table: { ...current.table, ...(patch.table ?? {}) },
    task: { ...current.task, ...(patch.task ?? {}) },
    codeBlock: { ...current.codeBlock, ...(patch.codeBlock ?? {}) },
  };
}
