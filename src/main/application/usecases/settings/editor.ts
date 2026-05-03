import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { EditorSettings } from '../../../domain/value-objects/AppConfig';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';

function publishEditorChanged(eventPublisher?: IEventPublisher): void {
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
function mergeEditorPatch(current: EditorSettings, patch: Partial<EditorSettings>): EditorSettings {
  return {
    behavior: { ...current.behavior, ...(patch.behavior ?? {}) },
    indent: { ...current.indent, ...(patch.indent ?? {}) },
    table: { ...current.table, ...(patch.table ?? {}) },
    task: { ...current.task, ...(patch.task ?? {}) },
    codeBlock: { ...current.codeBlock, ...(patch.codeBlock ?? {}) },
  };
}

export class GetEditorSettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<EditorSettings> {
    const config = await this.appConfigRepository.get();
    return config.editor;
  }
}

export class UpdateEditorSettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { editor: Partial<EditorSettings> }): Promise<EditorSettings> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      editor: mergeEditorPatch(config.editor, request.editor),
    }));
    publishEditorChanged(this.eventPublisher);
    return next.editor;
  }
}

export class ResetEditorSettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(): Promise<EditorSettings> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      editor: DEFAULT_APP_CONFIG.editor,
    }));
    publishEditorChanged(this.eventPublisher);
    return next.editor;
  }
}
