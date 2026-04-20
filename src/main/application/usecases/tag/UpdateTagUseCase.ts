import {
  TagEntity,
  type ITagRepository,
  type IUpdateTagUseCase,
  type UpdateTagRequest,
  type UpdateTagResponse,
  TagNotFoundError,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class UpdateTagUseCase implements IUpdateTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: UpdateTagRequest): Promise<UpdateTagResponse> {
    const tagProps = await this.tagRepository.findById(request.id);
    if (!tagProps) {
      throw new TagNotFoundError(request.id);
    }

    const tag = TagEntity.fromPersistence(tagProps);

    if (request.name !== undefined) {
      tag.rename(request.name);
    }
    if (request.color !== undefined) {
      tag.changeColor(request.color);
    }

    await this.tagRepository.save(tag);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.TAG_UPDATED,
      timestamp: new Date(),
      payload: { tag: tag.toPersistence() },
    });

    return { tag: tag.toPersistence() };
  }
}
