import { Effect, Layer } from 'effect';
import {
  ExporterPort,
  ExportUseCasesPort,
  FileStoragePort,
  MarkdownProcessorPort,
  NoteRepositoryPort,
  PathServicePort,
  WorkspaceRepositoryPort,
  type ExportOptions,
  type IExportUseCases,
} from '../../../domain';

export const ExportUseCasesLive = Layer.effect(
  ExportUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const files = yield* FileStoragePort;
    const markdown = yield* MarkdownProcessorPort;
    const exporter = yield* ExporterPort;
    const paths = yield* PathServicePort;
    const load = (noteId: string) =>
      Effect.gen(function* () {
        const note = yield* notes.findById(noteId);
        if (!note?.filePath || !note.workspaceId) {
          return yield* Effect.fail(
            new Error(`Note not found: ${noteId}`),
          );
        }
        const workspace = yield* workspaces.findById(note.workspaceId);
        if (!workspace) {
          return yield* Effect.fail(
            new Error(`Workspace not found: ${note.workspaceId}`),
          );
        }
        const absolutePath = yield* paths.join(
          workspace.folderPath,
          note.filePath,
        );
        const content = yield* files.read(absolutePath);
        if (!content) {
          return yield* Effect.fail(
            new Error('Could not read note content'),
          );
        }
        return { note, content };
      });
    const renderDocument = (
      noteId: string,
      options?: ExportOptions,
    ) =>
      load(noteId).pipe(
        Effect.flatMap(({ note, content }) =>
          markdown.markdownToHtml(content).pipe(
            Effect.flatMap((html) =>
              exporter.generateHtmlDocument(html, {
                title: note.title || 'Untitled',
                theme: options?.theme || 'light',
                includeStyles: true,
              }),
            ),
            Effect.map((html) => ({ note, html })),
          ),
        ),
      );
    const service: IExportUseCases = {
      exportHtml: {
        execute: (noteId, options) =>
          notes.findById(noteId).pipe(
            Effect.flatMap((note) => {
              if (!note?.filePath || !note.workspaceId) {
                return Effect.fail(
                  new Error(`Note not found: ${noteId}`),
                );
              }
              const filename = `${
                options?.title || note.title || 'note'
              }.html`;
              return options?.renderedHtml
                ? Effect.succeed({
                    content: options.renderedHtml,
                    filename,
                    mimeType: 'text/html',
                  })
                : renderDocument(noteId, options).pipe(
                    Effect.map(({ html }) => ({
                      content: html,
                      filename,
                      mimeType: 'text/html',
                    })),
                  );
            }),
          ),
      },
      exportPdf: {
        execute: (noteId, options) =>
          exporter.isPdfAvailable().pipe(
            Effect.flatMap((available) =>
              available
                ? Effect.void
                : Effect.fail(
                    new Error('PDF export is not available'),
                  ),
            ),
            Effect.flatMap(() =>
              options?.renderedHtml
                ? exporter
                    .renderToPdf(options.renderedHtml, {
                      format: 'A4',
                      printBackground: true,
                    })
                    .pipe(
                      Effect.map((content) => ({
                        content,
                        filename: `${options.title || 'note'}.pdf`,
                        mimeType: 'application/pdf',
                      })),
                    )
                : renderDocument(noteId, options).pipe(
                    Effect.flatMap(({ note, html }) =>
                      exporter
                        .renderToPdf(html, {
                          format: 'A4',
                          printBackground: true,
                        })
                        .pipe(
                          Effect.map((content) => ({
                            content,
                            filename: `${note.title || 'note'}.pdf`,
                            mimeType: 'application/pdf',
                          })),
                        ),
                    ),
                  ),
            ),
          ),
      },
      exportMarkdown: {
        execute: (noteId, options) =>
          load(noteId).pipe(
            Effect.map(({ note, content }) => {
              const exported = options?.includeFrontmatter
                ? [
                    '---',
                    `title: "${note.title || 'Untitled'}"`,
                    `created: ${note.createdAt.toISOString()}`,
                    `updated: ${note.updatedAt.toISOString()}`,
                    '---',
                    '',
                    content,
                  ].join('\n')
                : content;
              return {
                content: exported,
                filename: `${note.title || 'note'}.md`,
                mimeType: 'text/markdown',
              };
            }),
          ),
      },
    };
    return service;
  }),
);
