/**
 * ILinearSource — read-only access to the user's assigned Linear issues.
 * Implemented via the Linear GraphQL API with a personal API key; returns []
 * when no key is configured or the request fails.
 */

export interface LinearIssue {
  /** Human identifier, e.g. "ENG-123". */
  identifier: string;
  title: string;
  /** Workflow state name, e.g. "In Progress". */
  state: string;
  /** Linear priority 0–4 (0 = none, 1 = urgent … 4 = low). */
  priority: number;
  url: string;
  /** ISO date (YYYY-MM-DD) or null. */
  dueDate: string | null;
}

export interface ILinearSource {
  /** Open issues assigned to the API key's owner. Returns [] when no key is
   *  configured or the call fails. */
  getAssignedIssues(): Promise<LinearIssue[]>;
}
