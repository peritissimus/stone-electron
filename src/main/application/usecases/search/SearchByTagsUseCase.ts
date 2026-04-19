import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type {
  ISearchByTagsUseCase,
  SearchByTagsRequest,
  SearchByTagsResponse,
} from '../../../domain/ports/in/ISearchUseCases';

export class SearchByTagsUseCase implements ISearchByTagsUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(request: SearchByTagsRequest): Promise<SearchByTagsResponse> {
    // NOTE: Tag filtering requires a tag repository - for now return empty
    // TODO: Implement when ITagRepository is available in use case deps
    const notes: SearchByTagsResponse['notes'] = [];

    // Apply pagination
    const offset = request.offset || 0;
    const limit = request.limit || notes.length;
    const paginatedNotes = notes.slice(offset, offset + limit);

    return {
      notes: paginatedNotes,
      total: notes.length,
    };
  }
}
