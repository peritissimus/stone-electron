/**
 * Tag Use Cases Port (Inbound)
 */

import type { TagProps } from '../../entities';
import type { TagWithCount } from '../out/ITagRepository';

// Re-export from outbound port
export type { TagWithCount };

export interface CreateTagRequest {
  name: string;
  color?: string;
}

export interface CreateTagResponse {
  tag: TagProps;
}

export interface UpdateTagRequest {
  id: string;
  name?: string;
  color?: string;
}

export interface UpdateTagResponse {
  tag: TagProps;
}

export interface GetTagRequest {
  id: string;
}

export interface GetTagResponse {
  tag: TagProps;
}

export interface ListTagsRequest {
  includeNoteCount?: boolean;
}

export interface ListTagsResponse {
  tags: TagProps[] | TagWithCount[];
}

export interface DeleteTagRequest {
  id: string;
}

export interface AddTagToNoteRequest {
  noteId: string;
  tagId: string;
}

export interface RemoveTagFromNoteRequest {
  noteId: string;
  tagId: string;
}

export interface GetNoteTagsRequest {
  noteId: string;
}

export interface GetNoteTagsResponse {
  tags: TagProps[];
}

// Use Case Interfaces
export interface ICreateTagUseCase {
  execute(request: CreateTagRequest): Promise<CreateTagResponse>;
}

export interface IUpdateTagUseCase {
  execute(request: UpdateTagRequest): Promise<UpdateTagResponse>;
}

export interface IGetTagUseCase {
  execute(request: GetTagRequest): Promise<GetTagResponse>;
}

export interface IListTagsUseCase {
  execute(request?: ListTagsRequest): Promise<ListTagsResponse>;
}

export interface IDeleteTagUseCase {
  execute(request: DeleteTagRequest): Promise<void>;
}

export interface IAddTagToNoteUseCase {
  execute(request: AddTagToNoteRequest): Promise<void>;
}

export interface IRemoveTagFromNoteUseCase {
  execute(request: RemoveTagFromNoteRequest): Promise<void>;
}

export interface IGetNoteTagsUseCase {
  execute(request: GetNoteTagsRequest): Promise<GetNoteTagsResponse>;
}

/**
 * Aggregated Tag Use Cases (for DI container)
 */
export interface ITagUseCases {
  createTag: ICreateTagUseCase;
  updateTag: IUpdateTagUseCase;
  getTag: IGetTagUseCase;
  listTags: IListTagsUseCase;
  deleteTag: IDeleteTagUseCase;
  addTagToNote: IAddTagToNoteUseCase;
  removeTagFromNote: IRemoveTagFromNoteUseCase;
  getNoteTags: IGetNoteTagsUseCase;
}
