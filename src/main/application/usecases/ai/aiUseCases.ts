import { Effect, Layer } from 'effect';
import {
  AIUseCasesPort,
  AppConfigRepositoryPort,
  IndexRepositoryPort,
  JournalReaderPort,
  MarkdownProcessorPort,
  NoteRepositoryPort,
  SearchUseCasesPort,
  TextGeneratorPort,
  WorkspaceRepositoryPort,
  formatJournalDate,
  stripFirstHeading,
  type CitationSource,
  type IAIUseCases,
} from '../../../domain';

const shortExcerpt = (text: string, max = 1400) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= max
    ? normalized
    : `${normalized.slice(0, max).trim()}…`;
};

export const AIUseCasesLive = Layer.effect(
  AIUseCasesPort,
  Effect.gen(function* () {
    const search = yield* SearchUseCasesPort;
    const notes = yield* NoteRepositoryPort;
    const text = yield* TextGeneratorPort;
    const journals = yield* JournalReaderPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const configs = yield* AppConfigRepositoryPort;
    const markdown = yield* MarkdownProcessorPort;
    const index = yield* IndexRepositoryPort;
    const service: IAIUseCases = {
      askNotes: {
        execute: (request) =>
          Effect.gen(function* () {
            const millis = yield* Effect.clockWith(
              (clock) => clock.currentTimeMillis,
            );
            const today = formatJournalDate(new Date(millis));
            const plan = yield* text
              .planQuery({ query: request.query, today })
              .pipe(
                Effect.catchAll(() =>
                  Effect.succeed({
                    searchQuery: request.query,
                    dateStart: null,
                    dateEnd: null,
                  }),
                ),
              );
            const sources: CitationSource[] = [];
            const seen = new Set<string>();
            if (plan.dateStart) {
              const journalSources = yield* Effect.gen(function* () {
                const workspace = yield* (
                  request.workspaceId
                    ? workspaces.findById(request.workspaceId)
                    : workspaces.findActive()
                );
                if (!workspace) return [];
                const start =
                  plan.dateStart! <= (plan.dateEnd ?? plan.dateStart!)
                    ? plan.dateStart!
                    : plan.dateEnd!;
                const end =
                  plan.dateStart! <= (plan.dateEnd ?? plan.dateStart!)
                    ? (plan.dateEnd ?? plan.dateStart!)
                    : plan.dateStart!;
                const span =
                  Math.abs(
                    Date.parse(`${end}T00:00:00Z`) -
                      Date.parse(`${start}T00:00:00Z`),
                  ) / 86_400_000;
                if (span > 14) return [];
                const config = yield* configs.get();
                const records = yield* journals.findRecent({
                  workspaceId: workspace.id,
                  workspaceFolderPath: workspace.folderPath,
                  journalFolder:
                    config.notes.locationPolicy.journalFolder,
                  oldestDate: start,
                  newestDate: end,
                });
                return [...records]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .flatMap((record) => {
                    const body = record.content
                      ? stripFirstHeading(record.content).trim()
                      : '';
                    return body
                      ? [
                          {
                            chunkId: `journal:${record.date}`,
                            noteId: record.noteId,
                            title: `Journal — ${record.date}`,
                            excerpt: shortExcerpt(body),
                            date: record.date,
                          },
                        ]
                      : [];
                  });
              }).pipe(Effect.catchAll(() => Effect.succeed([])));
              for (const source of journalSources.slice(0, 10)) {
                sources.push(source);
                seen.add(source.noteId);
              }
            }
            const response = yield* search.hybridSearch.execute({
              query: plan.searchQuery,
              workspaceId: request.workspaceId,
              limit: request.limit ?? 6,
            });
            for (const row of response.results) {
              if (sources.length >= 10) break;
              if (seen.has(row.note.id)) continue;
              if (row.chunks?.length) {
                for (const chunk of row.chunks) {
                  if (sources.length >= 10) break;
                  if (!chunk.excerpt.trim()) continue;
                  sources.push({
                    chunkId: chunk.chunkId,
                    noteId: chunk.noteId,
                    title: row.note.title || 'Untitled',
                    headingPath:
                      chunk.headingPath.length > 0
                        ? chunk.headingPath
                        : undefined,
                    excerpt: chunk.excerpt,
                  });
                }
              } else {
                const content = yield* notes.getContentById(row.note.id);
                if (content?.trim()) {
                  sources.push({
                    chunkId: row.note.id,
                    noteId: row.note.id,
                    title: row.note.title || 'Untitled',
                    excerpt: shortExcerpt(content),
                  });
                }
              }
            }
            const answer = yield* text.generateAnswer({
              query: request.query,
              sources,
              today,
            });
            return { answer: answer.text, sources: answer.usedSources };
          }),
      },
      summarizeNote: {
        execute: (request) =>
          Effect.gen(function* () {
            const note = yield* notes.findById(request.noteId);
            if (!note) {
              return yield* Effect.fail(
                new Error(`Note not found: ${request.noteId}`),
              );
            }
            const content = yield* notes.getContentById(request.noteId);
            if (!content) return { summary: '', sources: [] };
            const plain = yield* markdown.extractPlainText(content);
            const source = {
              chunkId: note.id,
              noteId: note.id,
              title: note.title || 'Untitled',
              excerpt: shortExcerpt(plain, 5000),
            };
            const answer = yield* text.generateAnswer({
              query: `Summarize this note: ${source.title}`,
              sources: [source],
            });
            return {
              summary: answer.text,
              sources: answer.usedSources,
            };
          }),
      },
      suggestLinks: {
        execute: (request) =>
          index.getNoteVector(request.noteId).pipe(
            Effect.flatMap((vector) =>
              vector
                ? notes.findById(request.noteId).pipe(
                    Effect.flatMap((note) =>
                      note
                        ? index.findSimilarNotesByVector(vector, {
                            limit: request.limit ?? 8,
                            workspaceId: note.workspaceId || undefined,
                            excludeNoteId: request.noteId,
                          })
                        : Effect.succeed([]),
                    ),
                  )
                : Effect.succeed([]),
            ),
            Effect.map((similar) => ({
              links: similar.map((item) => ({
                noteId: item.noteId,
                title: item.title,
                reason: 'Semantically similar note',
                score: item.similarity,
              })),
            })),
          ),
      },
    };
    return service;
  }),
);
