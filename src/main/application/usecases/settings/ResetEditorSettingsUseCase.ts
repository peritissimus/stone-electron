import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { EditorSettings } from '../../../domain/value-objects/AppConfig';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';
import { publishEditorChanged } from './editorHelpers';

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
