import { formatJournalDate } from '../../../domain';
import type {
  DailyReviewExternalResult,
  ExternalSourceId,
  IAppConfigRepository,
  IExternalSource,
  IExternalSourceRegistry,
} from '../../../domain';
import type { DailyReviewSnapshot } from '../../../domain/ports/in/IDailyReviewUseCases';

const MAIL_LIMIT = 10;
const SNAPSHOT_TTL_MS = 5 * 60_000;
/**
 * Deliberate order, preserved as it was. Written as a rank per source rather
 * than a bare list so the type is exhaustive: a new source stops this
 * compiling until it has been given a position, instead of silently never
 * being loaded.
 */
const LOAD_RANK: Record<ExternalSourceId, number> = { linear: 0, mail: 1, calendar: 2 };
const LOAD_ORDER = (Object.keys(LOAD_RANK) as ExternalSourceId[]).sort(
  (left, right) => LOAD_RANK[left] - LOAD_RANK[right],
);

export interface ExternalSourceRegistryDeps {
  sources: IExternalSource[];
  appConfigRepository: IAppConfigRepository;
  now?: () => number;
}

interface CachedResult {
  date: string;
  loadedAt: number;
  result: DailyReviewExternalResult;
}

export class ExternalSourceRegistry implements IExternalSourceRegistry {
  private readonly sources: Map<ExternalSourceId, IExternalSource>;
  private readonly cache = new Map<ExternalSourceId, CachedResult>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly deps: ExternalSourceRegistryDeps) {
    this.sources = new Map(deps.sources.map((source) => [source.source, source]));
  }

  load(
    source: ExternalSourceId,
    options: { date?: string; signal?: AbortSignal } = {},
  ): Promise<DailyReviewExternalResult> {
    const work = this.queue.then(() => this.loadNow(source, options));
    this.queue = work.then(
      () => undefined,
      () => undefined,
    );
    return work;
  }

  async loadAll(
    options: { date?: string; signal?: AbortSignal } = {},
  ): Promise<DailyReviewExternalResult[]> {
    const results: DailyReviewExternalResult[] = [];
    for (const source of LOAD_ORDER) {
      results.push(await this.load(source, options));
    }
    return results;
  }

  mergeInto(snapshot: DailyReviewSnapshot): DailyReviewSnapshot {
    const now = this.deps.now?.() ?? Date.now();
    let merged = { ...snapshot };
    for (const cached of this.cache.values()) {
      if (cached.date !== snapshot.date || now - cached.loadedAt > SNAPSHOT_TTL_MS) continue;
      const result = cached.result;
      if (result.status !== 'connected') continue;
      switch (result.source) {
        case 'calendar':
          merged = { ...merged, calendarEvents: result.data.events };
          break;
        case 'mail':
          merged = {
            ...merged,
            mailUnreadCount: result.data.unreadCount,
            mailMessages: result.data.messages,
          };
          break;
        case 'linear':
          merged = { ...merged, linearIssues: result.data.issues };
          break;
      }
    }
    return merged;
  }

  private async loadNow(
    sourceId: ExternalSourceId,
    options: { date?: string; signal?: AbortSignal },
  ): Promise<DailyReviewExternalResult> {
    const date = options.date ?? formatJournalDate(new Date());
    if (options.signal?.aborted) throw options.signal.reason;
    const source = this.sources.get(sourceId);
    if (!source) return unavailable(sourceId);

    try {
      const config = await this.deps.appConfigRepository.get();
      const result = await source.load({
        date,
        calendarIds: config.integrations.selectedCalendarIds,
        mailLimit: MAIL_LIMIT,
        signal: options.signal,
      });
      this.cache.set(sourceId, {
        date,
        loadedAt: this.deps.now?.() ?? Date.now(),
        result,
      });
      return result;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const result = failed(sourceId);
      this.cache.set(sourceId, {
        date,
        loadedAt: this.deps.now?.() ?? Date.now(),
        result,
      });
      return result;
    }
  }
}

function unavailable(source: ExternalSourceId): DailyReviewExternalResult {
  const base = {
    status: 'unavailable' as const,
    message: 'This integration is not available.',
  };
  switch (source) {
    case 'calendar':
      return { ...base, source, data: { events: [] } };
    case 'mail':
      return { ...base, source, data: { unreadCount: 0, messages: [] } };
    case 'linear':
      return { ...base, source, data: { issues: [] } };
  }
}

function failed(source: ExternalSourceId): DailyReviewExternalResult {
  const base = {
    status: 'error' as const,
    message: 'Could not load this integration.',
  };
  switch (source) {
    case 'calendar':
      return { ...base, source, data: { events: [] } };
    case 'mail':
      return { ...base, source, data: { unreadCount: 0, messages: [] } };
    case 'linear':
      return { ...base, source, data: { issues: [] } };
  }
}

