import { Context } from 'effect';
import type { Effect } from 'effect';

export interface IWorkspaceActivation {
  afterActivated: (workspaceId: string) => Effect.Effect<void, Error>;
}

export const WorkspaceActivationPort =
  Context.GenericTag<IWorkspaceActivation>('stone/IWorkspaceActivation');
