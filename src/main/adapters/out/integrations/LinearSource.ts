/**
 * LinearSource — fetches the API key owner's open assigned issues from the
 * Linear GraphQL API. Returns [] when no key is configured or the call fails,
 * so the Today page degrades silently.
 */

import type { IAppConfigRepository } from '../../../domain';
import type { ILinearSource, LinearIssue } from '../../../domain/ports/out/ILinearSource';
import { logger } from '../../../shared/utils';

const LINEAR_API = 'https://api.linear.app/graphql';

// Open issues assigned to the key's owner: not completed, not canceled.
const ASSIGNED_ISSUES_QUERY = `query {
  viewer {
    assignedIssues(
      first: 50
      filter: { completedAt: { null: true }, canceledAt: { null: true } }
    ) {
      nodes { identifier title priority url dueDate state { name } }
    }
  }
}`;

type FetchFn = typeof fetch;

interface LinearIssueNode {
  identifier?: string;
  title?: string;
  priority?: number;
  url?: string;
  dueDate?: string | null;
  state?: { name?: string } | null;
}

export interface LinearSourceDeps {
  appConfigRepository: IAppConfigRepository;
  /** Injectable for tests; defaults to global fetch. */
  fetchFn?: FetchFn;
}

export class LinearSource implements ILinearSource {
  constructor(private readonly deps: LinearSourceDeps) {}

  async getAssignedIssues(): Promise<LinearIssue[]> {
    const config = await this.deps.appConfigRepository.get();
    const apiKey = config.integrations.linearApiKey.trim();
    if (!apiKey) return [];

    try {
      const fetchFn = this.deps.fetchFn ?? fetch;
      const res = await fetchFn(LINEAR_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Linear personal API keys are sent as the raw Authorization value.
          Authorization: apiKey,
        },
        body: JSON.stringify({ query: ASSIGNED_ISSUES_QUERY }),
      });
      if (!res.ok) {
        logger.warn(`[LinearSource] request failed (${res.status})`);
        return [];
      }
      const json = (await res.json()) as {
        data?: { viewer?: { assignedIssues?: { nodes?: LinearIssueNode[] } } };
      };
      const nodes = json.data?.viewer?.assignedIssues?.nodes ?? [];
      return nodes.map((n) => ({
        identifier: String(n.identifier ?? ''),
        title: String(n.title ?? ''),
        state: String(n.state?.name ?? ''),
        priority: typeof n.priority === 'number' ? n.priority : 0,
        url: String(n.url ?? ''),
        dueDate: n.dueDate ? String(n.dueDate) : null,
      }));
    } catch (err) {
      logger.warn(`[LinearSource] unavailable: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }
}
