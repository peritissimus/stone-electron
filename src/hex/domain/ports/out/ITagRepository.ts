/**
 * Tag Repository Port (Outbound)
 */

import type { TagEntity, TagProps } from '../../entities';

export interface TagWithCount extends TagProps {
  noteCount: number;
}

export interface ITagRepository {
  findById(id: string): Promise<TagProps | null>;
  findByName(name: string): Promise<TagProps | null>;
  findAll(): Promise<TagProps[]>;
  findAllWithCounts(): Promise<TagWithCount[]>;
  findByNoteId(noteId: string): Promise<TagProps[]>;
  save(tag: TagEntity): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;

  // Note-Tag associations
  addTagToNote(noteId: string, tagId: string): Promise<void>;
  removeTagFromNote(noteId: string, tagId: string): Promise<void>;
  getNoteTags(noteId: string): Promise<TagProps[]>;
  setNoteTags(noteId: string, tagIds: string[]): Promise<void>;

  // Bulk operations
  getTagsForNotes(noteIds: string[]): Promise<Map<string, TagProps[]>>;
}
