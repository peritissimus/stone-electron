import type { IAppConfigRepository, IJournalReader } from '../../../domain';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type {
  JournalEntryDTO,
  ListJournalRangeRequest,
  ListJournalRangeResponse,
} from '../../../domain/ports/in/IJournalUseCases';
import { stripFirstHeading } from '../../../domain/services';
import { addCalendarDays, formatJournalDate } from './journalDate';

const MAX_LIMIT = 31;

export class ListJournalRangeUseCase {
  constructor(
    private readonly journalReader: IJournalReader,
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly appConfigRepository: IAppConfigRepository,
  ) {}

  async execute(request: ListJournalRangeRequest): Promise<ListJournalRangeResponse> {
    const workspace = request.workspaceId
      ? await this.workspaceRepository.findById(request.workspaceId)
      : await this.workspaceRepository.findActive();

    if (!workspace) {
      throw new Error('No active workspace');
    }

    const config = await this.appConfigRepository.get();
    const journalFolder = config.notes.locationPolicy.journalFolder;
    const limit = Math.min(Math.max(request.limit, 1), MAX_LIMIT);

    const today = new Date();
    const dateStrings = Array.from({ length: limit }, (_, offset) =>
      formatJournalDate(addCalendarDays(today, -offset)),
    );

    const records = await this.journalReader.findRecent({
      workspaceId: workspace.id,
      workspaceFolderPath: workspace.folderPath,
      journalFolder,
      oldestDate: dateStrings[dateStrings.length - 1],
      newestDate: dateStrings[0],
    });

    const recordsByDate = new Map(records.map((record) => [record.date, record]));
    const entries: JournalEntryDTO[] = dateStrings.map((date) => {
      const record = recordsByDate.get(date);
      // Strip the leading `# Title` heading the same way GetNoteContentUseCase
      // does — the note's title is rendered in the page chrome (and round-
      // tripped on save by UpdateNoteUseCase), so the editor body should
      // never contain a duplicate H1.
      const body = record?.content != null ? stripFirstHeading(record.content) : null;
      return {
        date,
        noteId: record?.noteId ?? null,
        exists: Boolean(record),
        content: body,
      };
    });

    return { entries };
  }
}
