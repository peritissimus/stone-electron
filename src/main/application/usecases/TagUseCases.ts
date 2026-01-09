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
  type ITagRepository,
  TagNotFoundError,
} from '../../domain';
import type { IEventPublisher } from '../../domain/ports/out/IEventPublisher';

// ============================================================================
// Use Case Implementations
// ============================================================================

export class CreateTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly eventPublisher?: IEventPublisher
  ) {}

  async execute(request: { name: string; color?: string }): Promise<{ tag: TagProps }> {
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

export class UpdateTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly eventPublisher?: IEventPublisher
  ) {}

  async execute(request: {
    id: string;
    name?: string;
    color?: string;
  }): Promise<{ tag: TagProps }> {
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

export class GetTagUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: { id: string }): Promise<{ tag: TagProps }> {
    const tagProps = await this.tagRepository.findById(request.id);
    if (!tagProps) {
      throw new TagNotFoundError(request.id);
    }

    return { tag: tagProps };
  }
}

export class ListTagsUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(): Promise<{ tags: TagProps[] }> {
    const tags = await this.tagRepository.findAll();
    return { tags };
  }
}

export class DeleteTagUseCase {
  constructor(
    private readonly tagRepository: ITagRepository,
    private readonly eventPublisher?: IEventPublisher
  ) {}

  async execute(request: { id: string }): Promise<void> {
    const exists = await this.tagRepository.exists(request.id);
    if (!exists) {
      throw new TagNotFoundError(request.id);
    }

    await this.tagRepository.delete(request.id);

    this.eventPublisher?.emit(EVENTS.TAG_DELETED, { id: request.id });
  }
}

export class AddTagToNoteUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: { noteId: string; tagId: string }): Promise<void> {
    await this.tagRepository.addTagToNote(request.noteId, request.tagId);
  }
}

export class RemoveTagFromNoteUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: { noteId: string; tagId: string }): Promise<void> {
    await this.tagRepository.removeTagFromNote(request.noteId, request.tagId);
  }
}

export class GetNoteTagsUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: { noteId: string }): Promise<{ tags: TagProps[] }> {
    const tags = await this.tagRepository.findByNoteId(request.noteId);
    return { tags };
  }
}

// ============================================================================
// Factory
// ============================================================================

export interface ITagUseCases {
  createTag: CreateTagUseCase;
  updateTag: UpdateTagUseCase;
  getTag: GetTagUseCase;
  listTags: ListTagsUseCase;
  deleteTag: DeleteTagUseCase;
  addTagToNote: AddTagToNoteUseCase;
  removeTagFromNote: RemoveTagFromNoteUseCase;
  getNoteTags: GetNoteTagsUseCase;
}

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
