/**
 * TagUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateTagUseCase,
  UpdateTagUseCase,
  GetTagUseCase,
  ListTagsUseCase,
  DeleteTagUseCase,
  AddTagToNoteUseCase,
  RemoveTagFromNoteUseCase,
  GetNoteTagsUseCase,
} from '../../../../src/main/application/usecases/tag';
import type { ITagRepository } from '../../../../src/main/domain/ports/out/ITagRepository';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import { TagNotFoundError } from '../../../../src/main/domain/errors';
import type { TagProps } from '../../../../src/main/domain/entities/Tag';

// Mock factories
function createMockTagRepository(): ITagRepository {
  return {
    findById: vi.fn(),
    findByName: vi.fn(),
    findByNoteId: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    addTagToNote: vi.fn(),
    removeTagFromNote: vi.fn(),
    getNotesForTag: vi.fn(),
  } as unknown as ITagRepository;
}

function createMockEventPublisher(): IEventPublisher {
  return {
    publish: vi.fn(),
    publishAll: vi.fn(),
    emit: vi.fn(),
    subscribe: vi.fn(),
    subscribeAll: vi.fn(),
  } as unknown as IEventPublisher;
}

function createTagProps(overrides: Partial<TagProps> = {}): TagProps {
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
  describe('CreateTagUseCase', () => {
    let tagRepo: ITagRepository;
    let eventPublisher: IEventPublisher;
    let useCase: CreateTagUseCase;

    beforeEach(() => {
      tagRepo = createMockTagRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new CreateTagUseCase(tagRepo, eventPublisher);
    });

    it('creates tag with name', async () => {
      vi.mocked(tagRepo.findAll).mockResolvedValue([]);
      vi.mocked(tagRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ name: 'new-tag' });

      expect(result.tag.name).toBe('new-tag');
      expect(tagRepo.save).toHaveBeenCalled();
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('creates tag with custom color', async () => {
      vi.mocked(tagRepo.findAll).mockResolvedValue([]);
      vi.mocked(tagRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ name: 'my-tag', color: '#ff5500' });

      expect(result.tag.name).toBe('my-tag');
      expect(result.tag.color).toBe('#ff5500');
    });

    it('returns existing tag if name already exists', async () => {
      const existingTag = createTagProps({ name: 'existing-tag' });
      vi.mocked(tagRepo.findAll).mockResolvedValue([existingTag]);

      const result = await useCase.execute({ name: 'Existing Tag' });

      expect(result.tag).toEqual(existingTag);
      expect(tagRepo.save).not.toHaveBeenCalled();
    });

    it('normalizes tag name', async () => {
      vi.mocked(tagRepo.findAll).mockResolvedValue([]);
      vi.mocked(tagRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ name: 'My New Tag' });

      expect(result.tag.name).toBe('my-new-tag');
    });
  });

  describe('UpdateTagUseCase', () => {
    let tagRepo: ITagRepository;
    let eventPublisher: IEventPublisher;
    let useCase: UpdateTagUseCase;

    beforeEach(() => {
      tagRepo = createMockTagRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new UpdateTagUseCase(tagRepo, eventPublisher);
    });

    it('updates tag name', async () => {
      const tagProps = createTagProps();
      vi.mocked(tagRepo.findById).mockResolvedValue(tagProps);
      vi.mocked(tagRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'tag-1', name: 'new-name' });

      expect(result.tag.name).toBe('new-name');
      expect(tagRepo.save).toHaveBeenCalled();
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('updates tag color', async () => {
      const tagProps = createTagProps();
      vi.mocked(tagRepo.findById).mockResolvedValue(tagProps);
      vi.mocked(tagRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'tag-1', color: '#00ff00' });

      expect(result.tag.color).toBe('#00ff00');
    });

    it('throws TagNotFoundError when tag not found', async () => {
      vi.mocked(tagRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent', name: 'new' })).rejects.toThrow(
        TagNotFoundError
      );
    });
  });

  describe('GetTagUseCase', () => {
    let tagRepo: ITagRepository;
    let useCase: GetTagUseCase;

    beforeEach(() => {
      tagRepo = createMockTagRepository();
      useCase = new GetTagUseCase(tagRepo);
    });

    it('returns tag when found', async () => {
      const tagProps = createTagProps();
      vi.mocked(tagRepo.findById).mockResolvedValue(tagProps);

      const result = await useCase.execute({ id: 'tag-1' });

      expect(result.tag).toEqual(tagProps);
      expect(tagRepo.findById).toHaveBeenCalledWith('tag-1');
    });

    it('throws TagNotFoundError when not found', async () => {
      vi.mocked(tagRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(TagNotFoundError);
    });
  });

  describe('ListTagsUseCase', () => {
    let tagRepo: ITagRepository;
    let useCase: ListTagsUseCase;

    beforeEach(() => {
      tagRepo = createMockTagRepository();
      useCase = new ListTagsUseCase(tagRepo);
    });

    it('returns all tags', async () => {
      const tags = [
        createTagProps({ id: 'tag-1', name: 'tag-one' }),
        createTagProps({ id: 'tag-2', name: 'tag-two' }),
      ];
      vi.mocked(tagRepo.findAll).mockResolvedValue(tags);

      const result = await useCase.execute();

      expect(result.tags).toHaveLength(2);
      expect(tagRepo.findAll).toHaveBeenCalled();
    });

    it('returns empty array when no tags', async () => {
      vi.mocked(tagRepo.findAll).mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result.tags).toHaveLength(0);
    });
  });

  describe('DeleteTagUseCase', () => {
    let tagRepo: ITagRepository;
    let eventPublisher: IEventPublisher;
    let useCase: DeleteTagUseCase;

    beforeEach(() => {
      tagRepo = createMockTagRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new DeleteTagUseCase(tagRepo, eventPublisher);
    });

    it('deletes tag', async () => {
      vi.mocked(tagRepo.exists).mockResolvedValue(true);
      vi.mocked(tagRepo.delete).mockResolvedValue(undefined);

      await useCase.execute({ id: 'tag-1' });

      expect(tagRepo.delete).toHaveBeenCalledWith('tag-1');
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('throws TagNotFoundError when tag not found', async () => {
      vi.mocked(tagRepo.exists).mockResolvedValue(false);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(TagNotFoundError);
    });
  });

  describe('AddTagToNoteUseCase', () => {
    let tagRepo: ITagRepository;
    let useCase: AddTagToNoteUseCase;

    beforeEach(() => {
      tagRepo = createMockTagRepository();
      useCase = new AddTagToNoteUseCase(tagRepo);
    });

    it('adds tag to note', async () => {
      vi.mocked(tagRepo.addTagToNote).mockResolvedValue(undefined);

      await useCase.execute({ noteId: 'note-1', tagId: 'tag-1' });

      expect(tagRepo.addTagToNote).toHaveBeenCalledWith('note-1', 'tag-1');
    });
  });

  describe('RemoveTagFromNoteUseCase', () => {
    let tagRepo: ITagRepository;
    let useCase: RemoveTagFromNoteUseCase;

    beforeEach(() => {
      tagRepo = createMockTagRepository();
      useCase = new RemoveTagFromNoteUseCase(tagRepo);
    });

    it('removes tag from note', async () => {
      vi.mocked(tagRepo.removeTagFromNote).mockResolvedValue(undefined);

      await useCase.execute({ noteId: 'note-1', tagId: 'tag-1' });

      expect(tagRepo.removeTagFromNote).toHaveBeenCalledWith('note-1', 'tag-1');
    });
  });

  describe('GetNoteTagsUseCase', () => {
    let tagRepo: ITagRepository;
    let useCase: GetNoteTagsUseCase;

    beforeEach(() => {
      tagRepo = createMockTagRepository();
      useCase = new GetNoteTagsUseCase(tagRepo);
    });

    it('returns tags for note', async () => {
      const tags = [
        createTagProps({ id: 'tag-1', name: 'work' }),
        createTagProps({ id: 'tag-2', name: 'personal' }),
      ];
      vi.mocked(tagRepo.findByNoteId).mockResolvedValue(tags);

      const result = await useCase.execute({ noteId: 'note-1' });

      expect(result.tags).toHaveLength(2);
      expect(tagRepo.findByNoteId).toHaveBeenCalledWith('note-1');
    });

    it('returns empty array when note has no tags', async () => {
      vi.mocked(tagRepo.findByNoteId).mockResolvedValue([]);

      const result = await useCase.execute({ noteId: 'note-1' });

      expect(result.tags).toHaveLength(0);
    });
  });
});
