import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IIdGenerator } from '../../../domain/ports/out/IIdGenerator';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import { NoteEntity } from '../../../domain/entities/Note';
import { DOMAIN_EVENT_TYPES } from '../../../domain';
import { formatJournalDate, parseJournalDate } from './journalDate';

export class OpenOrCreateJournalForDateUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly pathService: IPathService,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(input: {
    date: string;
    workspaceId?: string;
  }): Promise<{ noteId: string; created: boolean }> {
    const workspace = input.workspaceId
      ? await this.workspaceRepository.findById(input.workspaceId)
      : await this.workspaceRepository.findActive();

    if (!workspace) {
      throw new Error('No active workspace');
    }

    const config = await this.appConfigRepository.get();
    const journalFolder = config.notes.locationPolicy.journalFolder;

    const date = parseJournalDate(input.date);
    const dateStr = formatJournalDate(date);
    const journalFilePath = `${journalFolder}/${dateStr}.md`;

    const existing = await this.noteRepository.findByFilePath(journalFilePath, workspace.id);
    if (existing) {
      return { noteId: existing.id, created: false };
    }

    const absolutePath = this.pathService.join(workspace.folderPath, journalFilePath);
    const fileExists = await this.fileStorage.exists(absolutePath);

    if (!fileExists) {
      const journalDir = this.pathService.join(workspace.folderPath, journalFolder);
      await this.fileStorage.createDirectory(journalDir);
      await this.fileStorage.write(absolutePath, `# ${dateStr}\n\n`);
    }

    const note = NoteEntity.create({
      id: this.idGenerator.generate(),
      title: dateStr,
      workspaceId: workspace.id,
    });
    note.updateFilePath(journalFilePath);
    await this.noteRepository.save(note);

    // Announce the note so the renderer's noteStore/file tree see it
    // immediately — without this the file-watcher round-trip is the only
    // signal, which leaves a window where the newly-opened journal can't
    // be highlighted in the sidebar because it isn't in notesByPath yet.
    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.NOTE_CREATED,
      timestamp: new Date(),
      payload: { id: note.id },
    });
    return { noteId: note.id, created: !fileExists };
  }
}
