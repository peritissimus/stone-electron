/**
 * Quick Capture Use Cases - Fast note capture (journal append)
 */

import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IQuickCaptureUseCases } from '../../../domain/ports/in/IQuickCaptureUseCases';
import { NoteEntity } from '../../../domain/entities/Note';
import { logger } from '../../../shared/utils';
import path from 'node:path';
import crypto from 'node:crypto';

export interface QuickCaptureUseCasesDeps {
  noteRepository: INoteRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
}

class QuickCaptureUseCasesImpl implements IQuickCaptureUseCases {
  constructor(private deps: QuickCaptureUseCasesDeps) {}

  async appendToJournal(content: string, workspaceId?: string): Promise<{ noteId: string; appended: boolean }> {
    const { noteRepository, workspaceRepository, fileStorage } = this.deps;

    // Get active workspace
    let workspace;
    if (workspaceId) {
      workspace = await workspaceRepository.findById(workspaceId);
    } else {
      workspace = await workspaceRepository.findActive();
    }

    if (!workspace) {
      throw new Error('No active workspace');
    }

    // Get today's date for journal
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const journalTitle = `Journal ${dateStr}`;

    // Look for existing journal note
    const notes = await noteRepository.findAll({ isDeleted: false });
    const journalNote = notes.find(
      (n) => n.title === journalTitle && n.workspaceId === workspace.id
    );

    const timestamp = today.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const entryContent = `\n\n## ${timestamp}\n\n${content}`;

    if (journalNote && journalNote.filePath) {
      // Append to existing journal
      const absolutePath = path.join(workspace.folderPath, journalNote.filePath);
      const existingContent = await fileStorage.read(absolutePath) || '';
      await fileStorage.write(absolutePath, existingContent + entryContent);

      // Update timestamp - reconstruct entity and save
      const noteEntity = NoteEntity.fromPersistence(journalNote);
      await noteRepository.save(noteEntity);

      logger.info(`[QuickCapture] Appended to journal ${journalNote.id}`);
      return { noteId: journalNote.id, appended: true };
    } else {
      // Create new journal note
      const note = NoteEntity.create({
        id: crypto.randomUUID(),
        title: journalTitle,
        workspaceId: workspace.id,
      });

      // Create file path in journal folder
      const journalDir = path.join(workspace.folderPath, 'Journal');
      await fileStorage.createDirectory(journalDir);

      const filePath = `Journal/${journalTitle}.md`;
      const absolutePath = path.join(workspace.folderPath, filePath);

      const initialContent = `# ${journalTitle}${entryContent}`;
      await fileStorage.write(absolutePath, initialContent);

      // Set the file path on the entity and save
      note.updateFilePath(filePath);
      await noteRepository.save(note);

      logger.info(`[QuickCapture] Created new journal ${note.id}`);
      return { noteId: note.id, appended: false };
    }
  }
}

export function createQuickCaptureUseCases(deps: QuickCaptureUseCasesDeps): IQuickCaptureUseCases {
  return new QuickCaptureUseCasesImpl(deps);
}
