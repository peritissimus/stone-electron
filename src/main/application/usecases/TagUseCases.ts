/**
 * Tag Use Cases
 *
 * Application layer implementations for tag operations.
 */

import { generateId } from '@shared/utils/id';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  TagEntity,
  type TagProps,
  type TagWithCount,
  type ITagRepository,
  type ITagUseCases,
  type ICreateTagUseCase,
  type IUpdateTagUseCase,
  type IGetTagUseCase,
  type IListTagsUseCase,
  type IDeleteTagUseCase,
  type IAddTagToNoteUseCase,
  type IRemoveTagFromNoteUseCase,
  type IGetNoteTagsUseCase,
  type CreateTagRequest,
  type CreateTagResponse,
  type UpdateTagRequest,
  type UpdateTagResponse,
  type GetTagRequest,
  type GetTagResponse,
  type ListTagsRequest,
  type ListTagsResponse,
  type DeleteTagRequest,
  type AddTagToNoteRequest,
  type RemoveTagFromNoteRequest,
  type GetNoteTagsRequest,
  type GetNoteTagsResponse,
  TagNotFoundError,
} from '../../domain';
import type { IEventPublisher } from '../../domain/ports/out/IEventPublisher';

// ============================================================================
// Use Case Implementations
// ============================================================================

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

    this.eventPublisher?.emit(EVENTS.TAG_UPDATED, { tag: tag.toPersistence() });

    return { tag: tag.toPersistence() };
  }
}

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

export class DeleteTagUseCase implements IDeleteTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: DeleteTagRequest): Promise<void> {
    const exists = await this.tagRepository.exists(request.id);
    if (!exists) {
      throw new TagNotFoundError(request.id);
    }

    await this.tagRepository.delete(request.id);

    this.eventPublisher?.emit(EVENTS.TAG_DELETED, { id: request.id });
  }
}

export class AddTagToNoteUseCase implements IAddTagToNoteUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: AddTagToNoteRequest): Promise<void> {
    await this.tagRepository.addTagToNote(request.noteId, request.tagId);
  }
}

export class RemoveTagFromNoteUseCase implements IRemoveTagFromNoteUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: RemoveTagFromNoteRequest): Promise<void> {
    await this.tagRepository.removeTagFromNote(request.noteId, request.tagId);
  }
}

export class GetNoteTagsUseCase implements IGetNoteTagsUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: GetNoteTagsRequest): Promise<GetNoteTagsResponse> {
    const tags = await this.tagRepository.findByNoteId(request.noteId);
    return { tags };
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface TagUseCasesDeps {
  tagRepository: ITagRepository;
  eventPublisher?: IEventPublisher;
}

export function createTagUseCases(deps: TagUseCasesDeps): ITagUseCases {
  const { tagRepository, eventPublisher } = deps;

  return {
    createTag: new CreateTagUseCase(tagRepository, eventPublisher),
    updateTag: new UpdateTagUseCase(tagRepository, eventPublisher),
    getTag: new GetTagUseCase(tagRepository),
    listTags: new ListTagsUseCase(tagRepository),
    deleteTag: new DeleteTagUseCase(tagRepository, eventPublisher),
    addTagToNote: new AddTagToNoteUseCase(tagRepository),
    removeTagFromNote: new RemoveTagFromNoteUseCase(tagRepository),
    getNoteTags: new GetNoteTagsUseCase(tagRepository),
  };
}
