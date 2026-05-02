/**
 * Journal Reader Adapter
 *
 * Implements IJournalReader. Reads journal note metadata from the DB and
 * pulls each file's content from the file storage adapter in a single batch.
 */

import path from 'node:path';
import { and, eq, gte, like, lte } from 'drizzle-orm';
import { notes, type Database } from '../../../shared';
import type {
  IFileStorage,
  IJournalReader,
  JournalRecord,
  FindRecentJournalsInput,
} from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface JournalReaderDeps {
  db: Database;
  fileStorage: IFileStorage;
}

const JOURNAL_FILENAME_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;

export class JournalReader implements IJournalReader {
  constructor(private readonly deps: JournalReaderDeps) {}

  async findRecent(input: FindRecentJournalsInput): Promise<JournalRecord[]> {
    return handleOperation(
      async () => {
        const folderPrefix = `${input.journalFolder}/`;
        const newestPath = `${folderPrefix}${input.newestDate}.md`;
        const oldestPath = `${folderPrefix}${input.oldestDate}.md`;

        const rows = await this.deps.db
          .select({
            id: notes.id,
            filePath: notes.filePath,
          })
          .from(notes)
          .where(
            and(
              like(notes.filePath, `${folderPrefix}%`),
              eq(notes.workspaceId, input.workspaceId),
              eq(notes.isDeleted, false),
              gte(notes.filePath, oldestPath),
              lte(notes.filePath, newestPath),
            ),
          );

        const records = await Promise.all(
          rows.map(async (row) => {
            const filePath = row.filePath;
            if (!filePath) return null;

            const fileName = filePath.slice(folderPrefix.length);
            const match = JOURNAL_FILENAME_RE.exec(fileName);
            if (!match) return null;

            const absolutePath = path.join(input.workspaceFolderPath, filePath);
            const content = await this.deps.fileStorage.read(absolutePath);

            return {
              date: match[1],
              noteId: row.id,
              filePath,
              content,
            } satisfies JournalRecord;
          }),
        );

        return records.filter((record): record is JournalRecord => record !== null);
      },
      {
        adapter: 'JournalReader',
        operation: 'findRecent',
        context: {
          workspaceId: input.workspaceId,
          oldestDate: input.oldestDate,
          newestDate: input.newestDate,
        },
      },
    );
  }
}
