import {
  type ITagRepository,
  type IGetNoteTagsUseCase,
  type GetNoteTagsRequest,
  type GetNoteTagsResponse,
} from '../../../domain';

export class GetNoteTagsUseCase implements IGetNoteTagsUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: GetNoteTagsRequest): Promise<GetNoteTagsResponse> {
    const tags = await this.tagRepository.findByNoteId(request.noteId);
    return { tags };
  }
}
