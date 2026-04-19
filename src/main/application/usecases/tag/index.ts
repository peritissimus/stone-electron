import type { ITagRepository, ITagUseCases } from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import { CreateTagUseCase } from './CreateTagUseCase';
import { UpdateTagUseCase } from './UpdateTagUseCase';
import { GetTagUseCase } from './GetTagUseCase';
import { ListTagsUseCase } from './ListTagsUseCase';
import { DeleteTagUseCase } from './DeleteTagUseCase';
import { AddTagToNoteUseCase } from './AddTagToNoteUseCase';
import { RemoveTagFromNoteUseCase } from './RemoveTagFromNoteUseCase';
import { GetNoteTagsUseCase } from './GetNoteTagsUseCase';

export { CreateTagUseCase } from './CreateTagUseCase';
export { UpdateTagUseCase } from './UpdateTagUseCase';
export { GetTagUseCase } from './GetTagUseCase';
export { ListTagsUseCase } from './ListTagsUseCase';
export { DeleteTagUseCase } from './DeleteTagUseCase';
export { AddTagToNoteUseCase } from './AddTagToNoteUseCase';
export { RemoveTagFromNoteUseCase } from './RemoveTagFromNoteUseCase';
export { GetNoteTagsUseCase } from './GetNoteTagsUseCase';

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
