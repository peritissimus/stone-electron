import path from 'node:path';
import crypto from 'node:crypto';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import { NoteEntity } from '../../../domain/entities/Note';
import { logger } from '../../../shared/utils';

export class AppendToJournalUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(
    content: string,
    workspaceId?: string,
  ): Promise<{ noteId: string; appended: boolean }> {
    // Get active workspace
    let workspace;
    if (workspaceId) {
      workspace = await this.workspaceRepository.findById(workspaceId);
    } else {
      workspace = await this.workspaceRepository.findActive();
    }

    if (!workspace) {
      throw new Error('No active workspace');
    }

    // Get today's date for journal - format: YYYY-MM-DD (matches useJournalActions)
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const journalTitle = dateStr; // Just the date, e.g., "2026-01-11"
    const journalFilePath = `Journal/${dateStr}.md`;

    // Fast lookup: directly query by file path instead of fetching all notes
    const journalNote = await this.noteRepository.findByFilePath(journalFilePath, workspace.id);

    const timestamp = today.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const entryContent = `\n\n[${timestamp}] ${content}`;
    const absolutePath = path.join(workspace.folderPath, journalFilePath);

    if (journalNote) {
      // Append to existing journal
      const existingContent = (await this.fileStorage.read(absolutePath)) || '';
      await this.fileStorage.write(absolutePath, existingContent + entryContent);

      // Update timestamp - reconstruct entity and save
      const noteEntity = NoteEntity.fromPersistence(journalNote);
      await this.noteRepository.save(noteEntity);

      logger.info(`[QuickCapture] Appended to journal ${journalNote.id}`);
      return { noteId: journalNote.id, appended: true };
    } else {
      // Check if file exists on disk (may not be in DB yet)
      const fileExists = await this.fileStorage.exists(absolutePath);

      if (fileExists) {
        // File exists but not in DB - append to file and create DB entry
        const existingContent = (await this.fileStorage.read(absolutePath)) || '';
        await this.fileStorage.write(absolutePath, existingContent + entryContent);

        // Create DB entry for existing file
        const note = NoteEntity.create({
          id: crypto.randomUUID(),
          title: journalTitle,
          workspaceId: workspace.id,
        });
        note.updateFilePath(journalFilePath);
        await this.noteRepository.save(note);

        logger.info(`[QuickCapture] Appended to existing file and created DB entry ${note.id}`);
        return { noteId: note.id, appended: true };
      }

      // Create new journal note
      const note = NoteEntity.create({
        id: crypto.randomUUID(),
        title: journalTitle,
        workspaceId: workspace.id,
      });

      // Ensure journal directory exists
      const journalDir = path.join(workspace.folderPath, 'Journal');
      await this.fileStorage.createDirectory(journalDir);

      const initialContent = `# ${journalTitle}${entryContent}`;
      await this.fileStorage.write(absolutePath, initialContent);

      // Set the file path on the entity and save
      note.updateFilePath(journalFilePath);
      await this.noteRepository.save(note);

      logger.info(`[QuickCapture] Created new journal ${note.id}`);
      return { noteId: note.id, appended: false };
    }
  }
}
