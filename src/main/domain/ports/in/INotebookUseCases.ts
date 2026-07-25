/**
 * Notebook Use Cases Port (Inbound)
 *
 * Defines the contract for notebook-related use cases.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';
import type { NotebookProps } from '../../entities';
import type { NotebookWithCount } from '../out/INotebookRepository';

// Re-export from outbound port
export type { NotebookWithCount };

// Request/Response DTOs
export interface CreateNotebookRequest {
  name: string;
  parentId?: string;
  workspaceId?: string;
  folderPath?: string;
  icon?: string;
  color?: string;
}

export interface CreateNotebookResponse {
  notebook: NotebookProps;
}

export interface UpdateNotebookRequest {
  id: string;
  name?: string;
  parentId?: string;
  icon?: string;
  color?: string;
  position?: number;
}

export interface UpdateNotebookResponse {
  notebook: NotebookProps;
}

export interface GetNotebookRequest {
  id: string;
}

export interface GetNotebookResponse {
  notebook: NotebookProps;
}

export interface ListNotebooksRequest {
  workspaceId?: string;
  parentId?: string | null;
  includeNoteCount?: boolean;
}

export interface ListNotebooksResponse {
  notebooks: NotebookProps[] | NotebookWithCount[];
}

export interface DeleteNotebookRequest {
  id: string;
  deleteNotes?: boolean; // If true, delete notes; if false, move to root
}

export interface MoveNotebookRequest {
  id: string;
  targetParentId: string | null;
}

// Use Case Interfaces
export interface ICreateNotebookUseCase {
  execute(request: CreateNotebookRequest): Effect.Effect<CreateNotebookResponse, Error>;
}

export interface IUpdateNotebookUseCase {
  execute(request: UpdateNotebookRequest): Effect.Effect<UpdateNotebookResponse, Error>;
}

export interface IGetNotebookUseCase {
  execute(request: GetNotebookRequest): Effect.Effect<GetNotebookResponse, Error>;
}

export interface IListNotebooksUseCase {
  execute(request: ListNotebooksRequest): Effect.Effect<ListNotebooksResponse, Error>;
}

export interface IDeleteNotebookUseCase {
  execute(request: DeleteNotebookRequest): Effect.Effect<void, Error>;
}

export interface IMoveNotebookUseCase {
  execute(request: MoveNotebookRequest): Effect.Effect<void, Error>;
}

/**
 * Aggregated Notebook Use Cases Interface
 */
export interface INotebookUseCases {
  createNotebook: ICreateNotebookUseCase;
  updateNotebook: IUpdateNotebookUseCase;
  getNotebook: IGetNotebookUseCase;
  listNotebooks: IListNotebooksUseCase;
  deleteNotebook: IDeleteNotebookUseCase;
  moveNotebook: IMoveNotebookUseCase;
}

export const NotebookUseCasesPort =
  Context.GenericTag<INotebookUseCases>('stone/INotebookUseCases');
