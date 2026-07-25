import { Effect, Layer } from 'effect';
import {
  GraphUseCasesPort,
  LinkExtractor,
  NoteGraphBuilder,
  NoteLinkEntity,
  NoteLinkRepositoryPort,
  NoteRepositoryPort,
  WorkspaceRepositoryPort,
  type IGraphUseCases,
} from '../../../domain';

const noteMissing = (id: string) => new Error(`Note not found: ${id}`);

export const GraphUseCasesLive = Layer.effect(
  GraphUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const links = yield* NoteLinkRepositoryPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const service: IGraphUseCases = {
      getBacklinks: {
        execute: (noteId) =>
          Effect.gen(function* () {
            const target = yield* notes.findById(noteId);
            if (!target) return yield* Effect.fail(noteMissing(noteId));
            return (yield* links.getBacklinks(noteId)).map((source) => ({
              sourceId: source.id,
              sourceTitle: source.title || 'Untitled',
              targetId: noteId,
              targetTitle: target.title || 'Untitled',
              linkText: '',
            }));
          }),
      },
      getForwardLinks: {
        execute: (noteId) =>
          Effect.gen(function* () {
            const source = yield* notes.findById(noteId);
            if (!source) return yield* Effect.fail(noteMissing(noteId));
            return (yield* links.getForwardLinks(noteId)).map((target) => ({
              sourceId: noteId,
              sourceTitle: source.title || 'Untitled',
              targetId: target.id,
              targetTitle: target.title || 'Untitled',
              linkText: '',
            }));
          }),
      },
      getGraphData: {
        execute: (options) =>
          Effect.gen(function* () {
            const workspace = yield* workspaces.findActive();
            if (!workspace) return { nodes: [], links: [] };
            const [allNotes, allLinks] = yield* Effect.all(
              [
                notes.findAll({
                  workspaceId: workspace.id,
                  isDeleted: false,
                }),
                links.findAll(),
              ],
              { concurrency: 'unbounded' },
            );
            return NoteGraphBuilder.buildGraphData(
              allNotes,
              allLinks,
              options ?? {},
            );
          }),
      },
      updateNoteLinks: {
        execute: (noteId, content) =>
          Effect.gen(function* () {
            if (!(yield* notes.findById(noteId))) {
              return yield* Effect.fail(noteMissing(noteId));
            }
            const referencedTitles =
              LinkExtractor.getReferencedNoteTitles(content);
            yield* links.deleteFromNote(noteId);
            const workspace = yield* workspaces.findActive();
            if (!workspace) return;
            const workspaceNotes = yield* notes.findAll({
              workspaceId: workspace.id,
              isDeleted: false,
            });
            yield* Effect.forEach(
              referencedTitles,
              (title) => {
                const target = workspaceNotes.find(
                  (note) =>
                    note.title?.toLowerCase() === title.toLowerCase(),
                );
                return target && target.id !== noteId
                  ? links.save(
                      NoteLinkEntity.create({
                        sourceNoteId: noteId,
                        targetNoteId: target.id,
                      }),
                    )
                  : Effect.void;
              },
              { concurrency: 'unbounded', discard: true },
            );
          }),
      },
    };
    return service;
  }),
);
