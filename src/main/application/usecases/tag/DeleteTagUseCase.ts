import { EVENTS } from '@shared/constants/ipcChannels';
import {
  type ITagRepository,
  type IDeleteTagUseCase,
  type DeleteTagRequest,
  TagNotFoundError,
} from '../../../domain';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';

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
