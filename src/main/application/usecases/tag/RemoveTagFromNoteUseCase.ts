import {
  type ITagRepository,
  type IRemoveTagFromNoteUseCase,
  type RemoveTagFromNoteRequest,
} from '../../../domain';

export class RemoveTagFromNoteUseCase implements IRemoveTagFromNoteUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: RemoveTagFromNoteRequest): Promise<void> {
    await this.tagRepository.removeTagFromNote(request.noteId, request.tagId);
  }
}
