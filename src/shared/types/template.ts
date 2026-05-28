/**
 * Wire shapes for note templates.
 *
 * Templates are markdown files on disk at <workspace>/.stone/templates/
 * with optional YAML frontmatter for display metadata. Placeholders in
 * the body (`{{date}}`, `{{prompt:Attendees?}}`, `{{cursor}}`) are
 * substituted at render time.
 */

export type TemplatePlaceholderKind = 'date' | 'time' | 'cursor' | 'prompt';

export interface TemplatePromptPlaceholder {
  kind: 'prompt';
  /** The question asked of the user when creating a note from this template. */
  question: string;
}

export interface TemplateSimplePlaceholder {
  kind: 'date' | 'time' | 'cursor';
}

export type TemplatePlaceholder = TemplatePromptPlaceholder | TemplateSimplePlaceholder;

export interface Template {
  /** Stable id — the template filename without `.md`. */
  id: string;
  /** Display name (from frontmatter `name:` or pretty-cased filename). */
  name: string;
  /** Optional short blurb shown in the picker. */
  description: string | null;
  /** Raw markdown body, *before* any placeholder substitution. */
  body: string;
  /** Distinct prompt questions in the order they appear in the body. */
  prompts: string[];
}

export interface RenderedTemplate {
  /** The fully substituted markdown body. */
  body: string;
  /** Character offset of the `{{cursor}}` marker if present, else null. */
  cursorOffset: number | null;
}
