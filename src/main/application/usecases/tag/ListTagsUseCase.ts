import {
  type TagProps,
  type TagWithCount,
  type ITagRepository,
  type IListTagsUseCase,
  type ListTagsRequest,
  type ListTagsResponse,
} from '../../../domain';

export class ListTagsUseCase implements IListTagsUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request?: ListTagsRequest): Promise<ListTagsResponse> {
    const includeNoteCount = request?.includeNoteCount ?? false;
    const tags: TagProps[] | TagWithCount[] = includeNoteCount
      ? await this.tagRepository.findAllWithCounts()
      : await this.tagRepository.findAll();
    return { tags };
  }
}
