import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { TemplateUseCasesLive } from '../../../../src/main/application/usecases/template';
import {
  NoteUseCasesPort,
  TemplateRepositoryPort,
  TemplateUseCasesPort,
  WorkspaceRepositoryPort,
  type INoteUseCases,
} from '../../../../src/main/domain';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { ITemplateUseCases } from '../../../../src/main/domain/ports/in/ITemplateUseCases';
import type { ITemplateRepository } from '../../../../src/main/domain/ports/out/ITemplateRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import { adapterLayer } from '../../../helpers/adapterLayer';
import { effectifyUseCases } from '../../../helpers/effectUseCases';

type PromiseFacade<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseFacade<T[Key]> }
    : T;

function createMockTemplateRepository(): ITemplateRepository {
  return {
    list: vi.fn(),
    findById: vi.fn(),
    seedDefaultsIfEmpty: vi.fn(),
  };
}

function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findActive: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

type CreateNote = {
  execute: (request: {
    title?: string;
    content?: string;
    folderPath?: string;
    workspaceId?: string;
  }) => Promise<{ note: NoteProps }>;
};

function createMockCreateNote(): CreateNote {
  return {
    execute: vi.fn().mockResolvedValue({ note: note() }),
  };
}

function workspace(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Workspace',
    folderPath: '/workspace',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00'),
    lastAccessedAt: new Date('2026-01-02T00:00:00'),
    ...overrides,
  };
}

function note(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'Rendered title',
    filePath: 'Rendered title.md',
    notebookId: null,
    workspaceId: 'ws-1',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00'),
    updatedAt: new Date('2026-01-01T00:00:00'),
    ...overrides,
  };
}

describe('TemplateUseCases', () => {
  let templateRepository: ITemplateRepository;
  let workspaceRepository: IWorkspaceRepository;
  let createNote: CreateNote;
  let useCases: PromiseFacade<ITemplateUseCases>;

  beforeEach(() => {
    templateRepository = createMockTemplateRepository();
    workspaceRepository = createMockWorkspaceRepository();
    createNote = createMockCreateNote();
    const runtime = ManagedRuntime.make(
      TemplateUseCasesLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            adapterLayer(TemplateRepositoryPort, templateRepository),
            adapterLayer(WorkspaceRepositoryPort, workspaceRepository),
            Layer.succeed(
              NoteUseCasesPort,
              effectifyUseCases({ createNote }) as INoteUseCases,
            ),
          ),
        ),
      ),
    );
    const run = <A, E>(
      use: (service: ITemplateUseCases) => Effect.Effect<A, E>,
    ) =>
      runtime
        .runPromiseExit(
          TemplateUseCasesPort.pipe(
            Effect.flatMap((service) => use(service)),
          ),
        )
        .then((exit) => {
          if (Exit.isSuccess(exit)) return exit.value;
          throw Cause.squash(exit.cause);
        });
    useCases = {
      listTemplates: {
        execute: (request) =>
          run((service) => service.listTemplates.execute(request)),
      },
      createNoteFromTemplate: {
        execute: (request) =>
          run((service) =>
            service.createNoteFromTemplate.execute(request),
          ),
      },
    };
  });

  it('lists templates for the active workspace and extracts prompts', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace());
    vi.mocked(templateRepository.list).mockResolvedValue([
      {
        id: 'weekly',
        name: 'Weekly Review',
        description: 'Review template',
        body: '# {{prompt:Project}}\n\n{{prompt:Project}}\n{{cursor}}',
      },
    ]);

    const result = await useCases.listTemplates.execute();

    expect(templateRepository.list).toHaveBeenCalledWith('ws-1');
    expect(result.templates).toEqual([
      {
        id: 'weekly',
        name: 'Weekly Review',
        description: 'Review template',
        body: '# {{prompt:Project}}\n\n{{prompt:Project}}\n{{cursor}}',
        prompts: ['Project'],
      },
    ]);
  });

  it('returns an empty template list when no workspace is active', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(null);

    await expect(useCases.listTemplates.execute()).resolves.toEqual({ templates: [] });
    expect(templateRepository.list).not.toHaveBeenCalled();
  });

  it('renders a template into the standard create-note flow', async () => {
    vi.mocked(templateRepository.findById).mockResolvedValue({
      id: 'decision',
      name: 'Decision',
      description: null,
      body: '# {{prompt:Title}}\n\nDecision: {{prompt:Decision}}\n\n{{cursor}}',
    });

    const result = await useCases.createNoteFromTemplate.execute({
      workspaceId: 'ws-1',
      templateId: 'decision',
      destinationFolder: 'Decisions',
      promptAnswers: {
        Title: 'Use ports',
        Decision: 'Keep adapters swappable',
      },
    });

    expect(createNote.execute).toHaveBeenCalledWith({
      title: 'Use ports',
      content: '# Use ports\n\nDecision: Keep adapters swappable\n\n',
      folderPath: 'Decisions',
      workspaceId: 'ws-1',
    });
    expect(result).toEqual({ noteId: 'note-1', cursorOffset: 48 });
  });

  it('falls back to the template name when rendered markdown has no H1', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace());
    vi.mocked(templateRepository.findById).mockResolvedValue({
      id: 'scratch',
      name: 'Scratch',
      description: null,
      body: 'Body only',
    });

    await useCases.createNoteFromTemplate.execute({ templateId: 'scratch' });

    expect(createNote.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Scratch',
        content: 'Body only',
        workspaceId: 'ws-1',
      }),
    );
  });

  it('throws when the selected template does not exist', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace());
    vi.mocked(templateRepository.findById).mockResolvedValue(null);

    await expect(
      useCases.createNoteFromTemplate.execute({ templateId: 'missing' }),
    ).rejects.toThrow('Template not found: missing');
  });
});
