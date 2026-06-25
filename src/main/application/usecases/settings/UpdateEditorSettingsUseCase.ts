import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { EditorSettings } from '../../../domain/value-objects/AppConfig';
import { mergeEditorPatch, publishEditorChanged } from './editorHelpers';

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
