import {
  type ITagRepository,
  type IAddTagToNoteUseCase,
  type AddTagToNoteRequest,
} from '../../../domain';

export class AddTagToNoteUseCase implements IAddTagToNoteUseCase {
  constructor(private readonly tagRepository: ITagRepository) {}

  async execute(request: AddTagToNoteRequest): Promise<void> {
    await this.tagRepository.addTagToNote(request.noteId, request.tagId);
  }
}
