import { generateId } from '@shared/utils/id';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  TagEntity,
  type ITagRepository,
  type ICreateTagUseCase,
  type CreateTagRequest,
  type CreateTagResponse,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

export class CreateTagUseCase implements ICreateTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
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
      id: generateId(),
      name: request.name,
      color: request.color,
    });

    await this.tagRepository.save(tag);

    this.eventPublisher?.emit(EVENTS.TAG_CREATED, { tag: tag.toPersistence() });

    return { tag: tag.toPersistence() };
  }
}
