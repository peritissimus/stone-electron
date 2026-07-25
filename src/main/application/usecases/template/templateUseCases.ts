import { Effect, Layer } from 'effect';
import {
  NoteUseCasesPort,
  TemplateRenderer,
  TemplateRepositoryPort,
  TemplateUseCasesPort,
  WorkspaceRepositoryPort,
  type ITemplateUseCases,
} from '../../../domain';

const H1_PATTERN = /^#\s+(.+?)\s*$/m;

export const TemplateUseCasesLive = Layer.effect(
  TemplateUseCasesPort,
  Effect.gen(function* () {
    const templates = yield* TemplateRepositoryPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const notes = yield* NoteUseCasesPort;
    const service: ITemplateUseCases = {
      listTemplates: {
        execute: (request) =>
          Effect.gen(function* () {
            const workspaceId =
              request?.workspaceId ??
              (yield* workspaces.findActive())?.id;
            if (!workspaceId) return { templates: [] };
            return {
              templates: (yield* templates.list(workspaceId)).map(
                (record) => ({
                  id: record.id,
                  name: record.name,
                  description: record.description,
                  body: record.body,
                  prompts: TemplateRenderer.extractPrompts(record.body),
                }),
              ),
            };
          }),
      },
      createNoteFromTemplate: {
        execute: (request) =>
          Effect.gen(function* () {
            const workspaceId =
              request.workspaceId ??
              (yield* workspaces.findActive())?.id;
            if (!workspaceId) {
              return yield* Effect.fail(
                new Error('No active workspace'),
              );
            }
            const template = yield* templates.findById(
              workspaceId,
              request.templateId,
            );
            if (!template) {
              return yield* Effect.fail(
                new Error(`Template not found: ${request.templateId}`),
              );
            }
            const rendered = TemplateRenderer.render(template.body, {
              promptAnswers: request.promptAnswers,
            });
            const title =
              rendered.body.match(H1_PATTERN)?.[1]?.trim() ?? template.name;
            const result = yield* notes.createNote.execute({
              title,
              content: rendered.body,
              folderPath: request.destinationFolder,
              workspaceId,
            });
            return {
              noteId: result.note.id,
              cursorOffset: rendered.cursorOffset,
            };
          }),
      },
    };
    return service;
  }),
);
