/**
 * Template Use Cases Port
 *
 * Reading the picker's template list, and creating a note from a
 * chosen template after the user has answered any prompt placeholders.
 *
 * Template shape is duplicated from @shared/types/template by design —
 * domain may not import from shared. The two stay structurally
 * identical because both describe the same wire payload.
 */

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  body: string;
  /** Distinct prompt questions in the order they first appear. */
  prompts: string[];
}

export interface ListTemplatesRequest {
  workspaceId?: string;
}

export interface ListTemplatesResponse {
  templates: TemplateSummary[];
}

export interface CreateNoteFromTemplateRequest {
  templateId: string;
  /** Answers keyed by the verbatim prompt question. */
  promptAnswers?: Record<string, string>;
  workspaceId?: string;
  /** Optional filesystem destination relative to workspace root. */
  destinationFolder?: string;
}

export interface CreateNoteFromTemplateResponse {
  noteId: string;
  /** Editor caret offset for the rendered body, or null if no
   *  `{{cursor}}` marker was present. */
  cursorOffset: number | null;
}

export interface IListTemplatesUseCase {
  execute(request?: ListTemplatesRequest): Promise<ListTemplatesResponse>;
}

export interface ICreateNoteFromTemplateUseCase {
  execute(request: CreateNoteFromTemplateRequest): Promise<CreateNoteFromTemplateResponse>;
}

export interface ITemplateUseCases {
  listTemplates: IListTemplatesUseCase;
  createNoteFromTemplate: ICreateNoteFromTemplateUseCase;
}
