import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { EditorSettings } from '../../../domain/value-objects/AppConfig';

export class GetEditorSettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<EditorSettings> {
    const config = await this.appConfigRepository.get();
    return config.editor;
  }
}
