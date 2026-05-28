/**
 * GetIndexStatsUseCase — workspace resolution + index stats aggregation.
 *
 * Previously the IndexIPC handler did this directly by pulling two OUT
 * repositories and orchestrating in the adapter; that's a use-case
 * bypass and was the only place in the IPC layer doing it. Lifted into
 * an application-layer use case so all IN adapters can stay
 * dependency-only on the IN ports facade.
 */

import type {
  IGetIndexStatsUseCase,
  IndexStatsRequest,
  IndexStatsResponse,
} from '../../../domain/ports/in/IIndexUseCases';
import type { IIndexRepository } from '../../../domain/ports/out/IIndexRepository';
import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';

const EMPTY: IndexStatsResponse = {
  workspaceId: '',
  totalNotes: 0,
  indexedNotes: 0,
  pendingNotes: 0,
  failedNotes: 0,
  chunkCount: 0,
};

export class GetIndexStatsUseCase implements IGetIndexStatsUseCase {
  constructor(
    private readonly indexRepository: IIndexRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
  ) {}

  async execute(request?: IndexStatsRequest): Promise<IndexStatsResponse> {
    const workspaceId =
      request?.workspaceId ?? (await this.workspaceRepository.findActive())?.id;
    if (!workspaceId) return EMPTY;

    const stats = await this.indexRepository.getWorkspaceStats(workspaceId);
    return { workspaceId, ...stats };
  }
}
