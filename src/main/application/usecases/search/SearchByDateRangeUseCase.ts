import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type {
  ISearchByDateRangeUseCase,
  SearchByDateRangeRequest,
  SearchByDateRangeResponse,
} from '../../../domain/ports/in/ISearchUseCases';

export class SearchByDateRangeUseCase implements ISearchByDateRangeUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: SearchByDateRangeRequest): Promise<SearchByDateRangeResponse> {
    const field = request.field === 'created' ? 'createdAt' : 'updatedAt';
    const orderBy = field;
    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);

    // Get all notes for workspace and filter by date range
    const allNotes = await this.noteRepository.findAll({
      workspaceId: request.workspaceId,
      isDeleted: false,
      orderBy,
      orderDirection: 'desc',
    });

    const filteredNotes = allNotes.filter((note) => {
      const noteDate = note[field];
      return noteDate >= startDate && noteDate <= endDate;
    });

    const limitedNotes = request.limit ? filteredNotes.slice(0, request.limit) : filteredNotes;

    return {
      notes: limitedNotes,
      total: filteredNotes.length,
    };
  }
}
