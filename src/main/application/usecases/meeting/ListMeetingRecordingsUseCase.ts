/**
 * ListMeetingRecordingsUseCase — paged feed for the Meetings page.
 */

import type {
  IMeetingRecordingRepository,
  IWorkspaceRepository,
} from '../../../domain';
import type {
  IListMeetingRecordingsUseCase,
  ListMeetingRecordingsRequest,
  ListMeetingRecordingsResponse,
} from '../../../domain/ports/in/IMeetingUseCases';

export class ListMeetingRecordingsUseCase implements IListMeetingRecordingsUseCase {
  constructor(
    private readonly meetingRepository: IMeetingRecordingRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
  ) {}

  async execute(request: ListMeetingRecordingsRequest): Promise<ListMeetingRecordingsResponse> {
    const workspaceId =
      request.workspaceId ?? (await this.workspaceRepository.findActive())?.id;
    if (!workspaceId) return { recordings: [], nextCursor: null };

    const { recordings, nextCursor } = await this.meetingRepository.list({
      workspaceId,
      limit: request.limit ?? 30,
      cursor: request.cursor ? new Date(request.cursor) : undefined,
    });

    return {
      recordings: recordings.map((r) => r.toPersistence()),
      nextCursor: nextCursor ? nextCursor.getTime() : null,
    };
  }
}
