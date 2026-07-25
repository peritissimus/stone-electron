import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { TagUseCasesLive } from '../../../../src/main/application/usecases/tag';
import {
  EventPublisherPort,
  IdGeneratorPort,
  TagNotFoundError,
  TagRepositoryPort,
  TagUseCasesPort,
  type ITagUseCases,
  type TagProps,
} from '../../../../src/main/domain';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import type { ITagRepository } from '../../../../src/main/domain/ports/out/ITagRepository';
import { adapterLayer } from '../../../helpers/adapterLayer';
import { createMockIdGenerator } from './testDoubles';

type PromiseFacade<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseFacade<T[Key]> }
    : T;

function tag(overrides: Partial<TagProps> = {}): TagProps {
  return {
    id: 'tag-1',
    name: 'test-tag',
    color: '#6b7280',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

describe('TagUseCases', () => {
  let repository: ITagRepository;
  let publisher: IEventPublisher;
  let useCases: PromiseFacade<ITagUseCases>;

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      findByName: vi.fn(),
      findAll: vi.fn(async () => []),
      findAllWithCounts: vi.fn(async () => []),
      findByNoteId: vi.fn(async () => []),
      save: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      addTagToNote: vi.fn(),
      removeTagFromNote: vi.fn(),
      getNoteTags: vi.fn(),
      setNoteTags: vi.fn(),
      getTagsForNotes: vi.fn(),
    } as unknown as ITagRepository;
    publisher = { publish: vi.fn() } as unknown as IEventPublisher;
    const runtime = ManagedRuntime.make(
      TagUseCasesLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            adapterLayer(TagRepositoryPort, repository),
            adapterLayer(IdGeneratorPort, createMockIdGenerator()),
            adapterLayer(EventPublisherPort, publisher),
          ),
        ),
      ),
    );
    const run = <A, E>(
      use: (service: ITagUseCases) => Effect.Effect<A, E>,
    ) =>
      runtime
        .runPromiseExit(
          TagUseCasesPort.pipe(
            Effect.flatMap((service) => use(service)),
          ),
        )
        .then((exit) => {
          if (Exit.isSuccess(exit)) return exit.value;
          throw Cause.squash(exit.cause);
        });
    useCases = {
      createTag: {
        execute: (request) =>
          run((service) => service.createTag.execute(request)),
      },
      updateTag: {
        execute: (request) =>
          run((service) => service.updateTag.execute(request)),
      },
      getTag: {
        execute: (request) =>
          run((service) => service.getTag.execute(request)),
      },
      listTags: {
        execute: (request) =>
          run((service) => service.listTags.execute(request)),
      },
      deleteTag: {
        execute: (request) =>
          run((service) => service.deleteTag.execute(request)),
      },
      addTagToNote: {
        execute: (request) =>
          run((service) => service.addTagToNote.execute(request)),
      },
      removeTagFromNote: {
        execute: (request) =>
          run((service) => service.removeTagFromNote.execute(request)),
      },
      getNoteTags: {
        execute: (request) =>
          run((service) => service.getNoteTags.execute(request)),
      },
    };
  });

  it('creates normalized tags and publishes the persisted value', async () => {
    const result = await useCases.createTag.execute({
      name: 'My New Tag',
      color: '#ff5500',
    });
    expect(result.tag).toMatchObject({
      id: 'generated-id',
      name: 'my-new-tag',
      color: '#ff5500',
    });
    expect(repository.save).toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalled();
  });

  it('returns an existing normalized tag without saving it again', async () => {
    const existing = tag({ name: 'existing-tag' });
    vi.mocked(repository.findAll).mockResolvedValue([existing]);
    await expect(
      useCases.createTag.execute({ name: 'Existing Tag' }),
    ).resolves.toEqual({ tag: existing });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('updates tag properties and preserves typed missing failures', async () => {
    vi.mocked(repository.findById)
      .mockResolvedValueOnce(tag())
      .mockResolvedValueOnce(null);
    const result = await useCases.updateTag.execute({
      id: 'tag-1',
      name: 'Renamed Tag',
      color: '#00ff00',
    });
    expect(result.tag).toMatchObject({
      name: 'renamed-tag',
      color: '#00ff00',
    });
    expect(repository.save).toHaveBeenCalled();
    await expect(
      useCases.updateTag.execute({ id: 'missing', name: 'new' }),
    ).rejects.toBeInstanceOf(TagNotFoundError);
  });

  it('gets tags and rejects a missing tag with its domain error', async () => {
    vi.mocked(repository.findById)
      .mockResolvedValueOnce(tag())
      .mockResolvedValueOnce(null);
    await expect(useCases.getTag.execute({ id: 'tag-1' })).resolves.toEqual({
      tag: tag(),
    });
    await expect(
      useCases.getTag.execute({ id: 'missing' }),
    ).rejects.toBeInstanceOf(TagNotFoundError);
  });

  it('selects counted and uncounted tag lists', async () => {
    vi.mocked(repository.findAll).mockResolvedValue([tag()]);
    vi.mocked(repository.findAllWithCounts).mockResolvedValue([
      { ...tag(), noteCount: 2 },
    ]);
    await expect(useCases.listTags.execute()).resolves.toEqual({
      tags: [tag()],
    });
    await expect(
      useCases.listTags.execute({ includeNoteCount: true }),
    ).resolves.toEqual({ tags: [{ ...tag(), noteCount: 2 }] });
    expect(repository.findAllWithCounts).toHaveBeenCalled();
  });

  it('deletes existing tags and rejects missing ones', async () => {
    vi.mocked(repository.exists)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await useCases.deleteTag.execute({ id: 'tag-1' });
    expect(repository.delete).toHaveBeenCalledWith('tag-1');
    expect(publisher.publish).toHaveBeenCalled();
    await expect(
      useCases.deleteTag.execute({ id: 'missing' }),
    ).rejects.toBeInstanceOf(TagNotFoundError);
  });

  it('orchestrates note-tag relationships', async () => {
    const tags = [tag()];
    vi.mocked(repository.findByNoteId).mockResolvedValue(tags);
    await useCases.addTagToNote.execute({
      noteId: 'note-1',
      tagId: 'tag-1',
    });
    await useCases.removeTagFromNote.execute({
      noteId: 'note-1',
      tagId: 'tag-1',
    });
    await expect(
      useCases.getNoteTags.execute({ noteId: 'note-1' }),
    ).resolves.toEqual({ tags });
    expect(repository.addTagToNote).toHaveBeenCalledWith('note-1', 'tag-1');
    expect(repository.removeTagFromNote).toHaveBeenCalledWith(
      'note-1',
      'tag-1',
    );
  });
});
