import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { QuickNoteUseCasesLive } from '../../../../src/main/application/usecases/quickNote';
import {
  AppConfigRepositoryPort,
  NoteUseCasesPort,
  QuickNoteUseCasesPort,
  type INoteUseCases,
  type IQuickNoteUseCases,
} from '../../../../src/main/domain';
import type { NoteProps } from '../../../../src/main/domain/entities';
import type { IAppConfigRepository } from '../../../../src/main/domain/ports/out/IAppConfigRepository';
import { DEFAULT_APP_CONFIG } from '../../../../src/shared/types/settings';
import { adapterLayer } from '../../../helpers/adapterLayer';
import { effectifyUseCases } from '../../../helpers/effectUseCases';

describe('QuickNoteUseCases', () => {
  type CreateRequest = {
    title?: string;
    content?: string;
    folderPath?: string;
    workspaceId?: string;
  };
  let appConfigRepository: IAppConfigRepository;
  let createNote: {
    execute: (request: CreateRequest) => Promise<{ note: NoteProps }>;
  };
  let useCases: {
    createInSlot: (
      request: Parameters<IQuickNoteUseCases['createInSlot']>[0],
    ) => Promise<{ noteId: string }>;
  };

  beforeEach(() => {
    appConfigRepository = {
      get: vi.fn(async () => DEFAULT_APP_CONFIG),
    } as unknown as IAppConfigRepository;
    createNote = {
      execute: vi.fn(async (request: CreateRequest) => ({
        note: {
          id: 'note-1',
          title: request.title,
          filePath: `${request.folderPath}/note.md`,
          workspaceId: request.workspaceId ?? 'ws-1',
        } as NoteProps,
      })),
    };
    const runtime = ManagedRuntime.make(
      QuickNoteUseCasesLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            adapterLayer(AppConfigRepositoryPort, appConfigRepository),
            Layer.succeed(
              NoteUseCasesPort,
              effectifyUseCases({ createNote }) as INoteUseCases,
            ),
          ),
        ),
      ),
    );
    const run = <A, E>(
      use: (service: IQuickNoteUseCases) => Effect.Effect<A, E>,
    ) =>
      runtime
        .runPromiseExit(
          QuickNoteUseCasesPort.pipe(
            Effect.flatMap((service) => use(service)),
          ),
        )
        .then((exit) => {
          if (Exit.isSuccess(exit)) return exit.value;
          throw Cause.squash(exit.cause);
        });
    useCases = {
      createInSlot: (request) =>
        run((service) => service.createInSlot(request)),
    };
  });

  it.each([
    ['personal', 'Personal'],
    ['work', 'Work'],
  ] as const)('routes the %s slot through create-note', async (slot, folderPath) => {
    await expect(useCases.createInSlot({ slot })).resolves.toEqual({
      noteId: 'note-1',
    });
    expect(createNote.execute).toHaveBeenCalledWith(
      expect.objectContaining({ folderPath, content: '' }),
    );
  });

  it('uses configured folders and forwards explicit identity fields', async () => {
    vi.mocked(appConfigRepository.get).mockResolvedValue({
      ...DEFAULT_APP_CONFIG,
      notes: {
        locationPolicy: {
          ...DEFAULT_APP_CONFIG.notes.locationPolicy,
          quickNoteSlotFolders: {
            ...DEFAULT_APP_CONFIG.notes.locationPolicy.quickNoteSlotFolders,
            personal: 'Inbox',
          },
        },
      },
    });
    await useCases.createInSlot({
      slot: 'personal',
      title: 'Capture',
      workspaceId: 'ws-2',
    });
    expect(createNote.execute).toHaveBeenCalledWith({
      title: 'Capture',
      content: '',
      folderPath: 'Inbox',
      workspaceId: 'ws-2',
    });
  });

  it('rejects unknown slots before creating a note', async () => {
    await expect(
      useCases.createInSlot({
        // @ts-expect-error runtime guard
        slot: 'invalid',
      }),
    ).rejects.toThrow(/Unknown quick-note slot/);
    expect(createNote.execute).not.toHaveBeenCalled();
  });
});
