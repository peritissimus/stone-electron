import {
  TagEntity,
  type ITagRepository,
  type ICreateTagUseCase,
  type CreateTagRequest,
  type CreateTagResponse,
  type IIdGenerator,
  DOMAIN_EVENT_TYPES,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class CreateTagUseCase implements ICreateTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: CreateTagRequest): Promise<CreateTagResponse> {
    // Check if tag already exists
    const existingTags = await this.tagRepository.findAll();
    const normalizedName = TagEntity.normalizeName(request.name);
    const existing = existingTags.find((t) => t.name === normalizedName);

    if (existing) {
      return { tag: existing };
    }

    const tag = TagEntity.create({
      id: this.idGenerator.generate(),
      name: request.name,
      color: request.color,
    });

    await this.tagRepository.save(tag);

    this.eventPublisher?.publish({
      type: DOMAIN_EVENT_TYPES.TAG_CREATED,
      timestamp: new Date(),
      payload: { tag: tag.toPersistence() },
    });

    return { tag: tag.toPersistence() };
  }
}
