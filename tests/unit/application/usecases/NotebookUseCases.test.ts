/**
 * NotebookUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateNotebookUseCase,
  UpdateNotebookUseCase,
  GetNotebookUseCase,
  ListNotebooksUseCase,
  DeleteNotebookUseCase,
  MoveNotebookUseCase,
} from '../../../../src/main/application/usecases/NotebookUseCases';
import type { INotebookRepository } from '../../../../src/main/domain/ports/out/INotebookRepository';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import { NotebookNotFoundError } from '../../../../src/main/domain/errors';
import type { NotebookProps } from '../../../../src/main/domain/entities/Notebook';

// Mock factories
function createMockNotebookRepository(): INotebookRepository {
  return {
    findById: vi.fn(),
    findByWorkspaceId: vi.fn(),
    findByParentId: vi.fn(),
    findByFolderPath: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    count: vi.fn(),
  } as unknown as INotebookRepository;
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

function createNotebookProps(overrides: Partial<NotebookProps> = {}): NotebookProps {
  return {
    id: 'nb-1',
    name: 'Test Notebook',
    parentId: null,
    workspaceId: 'ws-1',
    folderPath: null,
    icon: '📁',
    color: '#3b82f6',
    position: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

describe('NotebookUseCases', () => {
  describe('CreateNotebookUseCase', () => {
    let notebookRepo: INotebookRepository;
    let eventPublisher: IEventPublisher;
    let useCase: CreateNotebookUseCase;

    beforeEach(() => {
      notebookRepo = createMockNotebookRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new CreateNotebookUseCase(notebookRepo, eventPublisher);
    });

    it('creates notebook with name', async () => {
      vi.mocked(notebookRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ name: 'My Notebook' });

      expect(result.notebook.name).toBe('My Notebook');
      expect(notebookRepo.save).toHaveBeenCalled();
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('creates notebook with all options', async () => {
      vi.mocked(notebookRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({
        name: 'My Notebook',
        parentId: 'parent-1',
        workspaceId: 'ws-1',
        folderPath: 'notebooks/my-notebook',
        icon: '📚',
        color: '#ff5500',
      });

      expect(result.notebook.name).toBe('My Notebook');
      expect(result.notebook.parentId).toBe('parent-1');
      expect(result.notebook.workspaceId).toBe('ws-1');
      expect(result.notebook.icon).toBe('📚');
      expect(result.notebook.color).toBe('#ff5500');
    });
  });

  describe('UpdateNotebookUseCase', () => {
    let notebookRepo: INotebookRepository;
    let eventPublisher: IEventPublisher;
    let useCase: UpdateNotebookUseCase;

    beforeEach(() => {
      notebookRepo = createMockNotebookRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new UpdateNotebookUseCase(notebookRepo, eventPublisher);
    });

    it('updates notebook name', async () => {
      const notebookProps = createNotebookProps();
      vi.mocked(notebookRepo.findById).mockResolvedValue(notebookProps);
      vi.mocked(notebookRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'nb-1', name: 'New Name' });

      expect(result.notebook.name).toBe('New Name');
      expect(notebookRepo.save).toHaveBeenCalled();
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('updates notebook icon', async () => {
      const notebookProps = createNotebookProps();
      vi.mocked(notebookRepo.findById).mockResolvedValue(notebookProps);
      vi.mocked(notebookRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'nb-1', icon: '🎯' });

      expect(result.notebook.icon).toBe('🎯');
    });

    it('updates notebook color', async () => {
      const notebookProps = createNotebookProps();
      vi.mocked(notebookRepo.findById).mockResolvedValue(notebookProps);
      vi.mocked(notebookRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'nb-1', color: '#00ff00' });

      expect(result.notebook.color).toBe('#00ff00');
    });

    it('updates notebook parentId', async () => {
      const notebookProps = createNotebookProps();
      vi.mocked(notebookRepo.findById).mockResolvedValue(notebookProps);
      vi.mocked(notebookRepo.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ id: 'nb-1', parentId: 'parent-1' });

      expect(result.notebook.parentId).toBe('parent-1');
    });

    it('throws NotebookNotFoundError when notebook not found', async () => {
      vi.mocked(notebookRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent', name: 'New' })).rejects.toThrow(
        NotebookNotFoundError
      );
    });
  });

  describe('GetNotebookUseCase', () => {
    let notebookRepo: INotebookRepository;
    let useCase: GetNotebookUseCase;

    beforeEach(() => {
      notebookRepo = createMockNotebookRepository();
      useCase = new GetNotebookUseCase(notebookRepo);
    });

    it('returns notebook when found', async () => {
      const notebookProps = createNotebookProps();
      vi.mocked(notebookRepo.findById).mockResolvedValue(notebookProps);

      const result = await useCase.execute({ id: 'nb-1' });

      expect(result.notebook).toEqual(notebookProps);
      expect(notebookRepo.findById).toHaveBeenCalledWith('nb-1');
    });

    it('throws NotebookNotFoundError when not found', async () => {
      vi.mocked(notebookRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(NotebookNotFoundError);
    });
  });

  describe('ListNotebooksUseCase', () => {
    let notebookRepo: INotebookRepository;
    let useCase: ListNotebooksUseCase;

    beforeEach(() => {
      notebookRepo = createMockNotebookRepository();
      useCase = new ListNotebooksUseCase(notebookRepo);
    });

    it('returns all notebooks without filter', async () => {
      const notebooks = [
        createNotebookProps({ id: 'nb-1' }),
        createNotebookProps({ id: 'nb-2', name: 'Second Notebook' }),
      ];
      vi.mocked(notebookRepo.findAll).mockResolvedValue(notebooks);

      const result = await useCase.execute({});

      expect(result.notebooks).toHaveLength(2);
      expect(notebookRepo.findAll).toHaveBeenCalled();
    });

    it('filters by workspaceId', async () => {
      const notebooks = [createNotebookProps({ workspaceId: 'ws-1' })];
      vi.mocked(notebookRepo.findByWorkspaceId).mockResolvedValue(notebooks);

      const result = await useCase.execute({ workspaceId: 'ws-1' });

      expect(result.notebooks).toHaveLength(1);
      expect(notebookRepo.findByWorkspaceId).toHaveBeenCalledWith('ws-1');
    });

    it('filters by parentId', async () => {
      const notebooks = [createNotebookProps({ parentId: 'parent-1' })];
      vi.mocked(notebookRepo.findByParentId).mockResolvedValue(notebooks);

      const result = await useCase.execute({ parentId: 'parent-1' });

      expect(result.notebooks).toHaveLength(1);
      expect(notebookRepo.findByParentId).toHaveBeenCalledWith('parent-1', undefined);
    });

    it('filters by parentId with workspaceId', async () => {
      const notebooks = [createNotebookProps({ parentId: 'parent-1', workspaceId: 'ws-1' })];
      vi.mocked(notebookRepo.findByParentId).mockResolvedValue(notebooks);

      const result = await useCase.execute({ parentId: 'parent-1', workspaceId: 'ws-1' });

      expect(result.notebooks).toHaveLength(1);
      expect(notebookRepo.findByParentId).toHaveBeenCalledWith('parent-1', 'ws-1');
    });

    it('returns root notebooks when parentId is null', async () => {
      const notebooks = [createNotebookProps({ parentId: null })];
      vi.mocked(notebookRepo.findByParentId).mockResolvedValue(notebooks);

      const result = await useCase.execute({ parentId: null });

      expect(result.notebooks).toHaveLength(1);
      expect(notebookRepo.findByParentId).toHaveBeenCalledWith(null, undefined);
    });
  });

  describe('DeleteNotebookUseCase', () => {
    let notebookRepo: INotebookRepository;
    let eventPublisher: IEventPublisher;
    let useCase: DeleteNotebookUseCase;

    beforeEach(() => {
      notebookRepo = createMockNotebookRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new DeleteNotebookUseCase(notebookRepo, eventPublisher);
    });

    it('deletes notebook', async () => {
      vi.mocked(notebookRepo.exists).mockResolvedValue(true);
      vi.mocked(notebookRepo.delete).mockResolvedValue(undefined);

      await useCase.execute({ id: 'nb-1' });

      expect(notebookRepo.delete).toHaveBeenCalledWith('nb-1');
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('throws NotebookNotFoundError when notebook not found', async () => {
      vi.mocked(notebookRepo.exists).mockResolvedValue(false);

      await expect(useCase.execute({ id: 'nonexistent' })).rejects.toThrow(NotebookNotFoundError);
    });
  });

  describe('MoveNotebookUseCase', () => {
    let notebookRepo: INotebookRepository;
    let eventPublisher: IEventPublisher;
    let useCase: MoveNotebookUseCase;

    beforeEach(() => {
      notebookRepo = createMockNotebookRepository();
      eventPublisher = createMockEventPublisher();
      useCase = new MoveNotebookUseCase(notebookRepo, eventPublisher);
    });

    it('moves notebook to new parent', async () => {
      const notebookProps = createNotebookProps();
      vi.mocked(notebookRepo.findById).mockResolvedValue(notebookProps);
      vi.mocked(notebookRepo.save).mockResolvedValue(undefined);

      await useCase.execute({ id: 'nb-1', targetParentId: 'new-parent' });

      expect(notebookRepo.save).toHaveBeenCalled();
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('moves notebook to root', async () => {
      const notebookProps = createNotebookProps({ parentId: 'old-parent' });
      vi.mocked(notebookRepo.findById).mockResolvedValue(notebookProps);
      vi.mocked(notebookRepo.save).mockResolvedValue(undefined);

      await useCase.execute({ id: 'nb-1', targetParentId: null });

      expect(notebookRepo.save).toHaveBeenCalled();
    });

    it('throws NotebookNotFoundError when notebook not found', async () => {
      vi.mocked(notebookRepo.findById).mockResolvedValue(null);

      await expect(useCase.execute({ id: 'nonexistent', targetParentId: null })).rejects.toThrow(
        NotebookNotFoundError
      );
    });
  });
});
