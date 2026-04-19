import {
  type ITagRepository,
  type IGetTagUseCase,
  type GetTagRequest,
  type GetTagResponse,
  TagNotFoundError,
} from '../../../domain';

export class GetTagUseCase implements IGetTagUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: GetTagRequest): Promise<GetTagResponse> {
    const tagProps = await this.tagRepository.findById(request.id);
    if (!tagProps) {
      throw new TagNotFoundError(request.id);
    }

    return { tag: tagProps };
  }
}
