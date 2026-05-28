/**
 * CreateNoteFromTemplateUseCase — renders the chosen template with the
 * user's prompt answers, then routes through the existing CreateNote
 * use case so the resulting file follows the standard note lifecycle
 * (write to disk, index, fire events).
 *
 * Title derivation: take the first H1 in the rendered body if present;
 * otherwise fall back to the template name. The H1 itself stays in the
 * body — Stone shows the title separately but doesn't strip it from
 * disk markdown.
 */

import type {
  ICreateNoteFromTemplateUseCase,
  CreateNoteFromTemplateRequest,
  CreateNoteFromTemplateResponse,
} from '../../../domain/ports/in/ITemplateUseCases';
import type { ICreateNoteUseCase } from '../../../domain/ports/in/INoteUseCases';
import type { ITemplateRepository } from '../../../domain/ports/out/ITemplateRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import { TemplateRenderer } from '../../../domain/services/TemplateRenderer';

const H1_PATTERN = /^#\s+(.+?)\s*$/m;

export class CreateNoteFromTemplateUseCase implements ICreateNoteFromTemplateUseCase {
  constructor(
    private readonly templateRepository: ITemplateRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly createNote: ICreateNoteUseCase,
  ) {}

  async execute(
    request: CreateNoteFromTemplateRequest,
  ): Promise<CreateNoteFromTemplateResponse> {
    const workspaceId =
      request.workspaceId ?? (await this.workspaceRepository.findActive())?.id;
    if (!workspaceId) {
      throw new Error('No active workspace');
    }

    const template = await this.templateRepository.findById(workspaceId, request.templateId);
    if (!template) {
      throw new Error(`Template not found: ${request.templateId}`);
    }

    const rendered = TemplateRenderer.render(template.body, {
      promptAnswers: request.promptAnswers,
    });

    const title = extractTitle(rendered.body) ?? template.name;

    const { note } = await this.createNote.execute({
      title,
      content: rendered.body,
      folderPath: request.destinationFolder,
      workspaceId,
    });

    return { noteId: note.id, cursorOffset: rendered.cursorOffset };
  }
}

function extractTitle(markdown: string): string | null {
  const match = markdown.match(H1_PATTERN);
  return match ? match[1].trim() : null;
}
