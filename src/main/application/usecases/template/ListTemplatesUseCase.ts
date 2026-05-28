/**
 * ListTemplatesUseCase — fetches the templates folder for the active
 * workspace, extracts prompt placeholders from each, and returns wire
 * shapes for the picker UI.
 */

import type {
  IListTemplatesUseCase,
  ListTemplatesRequest,
  ListTemplatesResponse,
} from '../../../domain/ports/in/ITemplateUseCases';
import type { ITemplateRepository } from '../../../domain/ports/out/ITemplateRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import { TemplateRenderer } from '../../../domain/services/TemplateRenderer';

export class ListTemplatesUseCase implements IListTemplatesUseCase {
  constructor(
    private readonly templateRepository: ITemplateRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
  ) {}

  async execute(request?: ListTemplatesRequest): Promise<ListTemplatesResponse> {
    const workspaceId =
      request?.workspaceId ?? (await this.workspaceRepository.findActive())?.id;
    if (!workspaceId) return { templates: [] };

    const records = await this.templateRepository.list(workspaceId);
    return {
      templates: records.map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description,
        body: record.body,
        prompts: TemplateRenderer.extractPrompts(record.body),
      })),
    };
  }
}
