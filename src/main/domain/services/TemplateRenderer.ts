/**
 * TemplateRenderer — pure markdown placeholder substitution.
 *
 * Domain service (no I/O). Supports four placeholder kinds:
 *
 *   {{date}}              → current ISO date, YYYY-MM-DD
 *   {{time}}              → 24h HH:MM
 *   {{cursor}}            → marker for where the editor should land
 *   {{prompt:question}}   → asks the caller; substitution is the answer
 *
 * The cursor offset is returned alongside the body so the renderer
 * (editor) can place the caret there. Unknown placeholders pass through
 * unchanged — silent failure on unknown syntax would hide bugs in
 * authored templates.
 */

const PLACEHOLDER_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

export interface TemplateRenderContext {
  /** Current wall-clock when rendering. Injectable for tests. */
  now?: Date;
  /** Answers keyed by the verbatim question text from `{{prompt:question}}`. */
  promptAnswers?: Record<string, string>;
}

export interface RenderedTemplate {
  body: string;
  /** Character offset of the (first) {{cursor}} marker in `body`, or null. */
  cursorOffset: number | null;
}

export const TemplateRenderer = {
  /**
   * Extract distinct prompt questions in the order they first appear
   * in the body. Used to drive the picker UI's prompt sequence.
   */
  extractPrompts(body: string): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
      const token = match[1].trim();
      if (!token.startsWith('prompt:')) continue;
      const question = token.slice('prompt:'.length).trim();
      if (!question || seen.has(question)) continue;
      seen.add(question);
      ordered.push(question);
    }
    return ordered;
  },

  render(body: string, context: TemplateRenderContext = {}): RenderedTemplate {
    const now = context.now ?? new Date();
    const answers = context.promptAnswers ?? {};
    let cursorOffset: number | null = null;

    // We build the output incrementally so we can track where the
    // {{cursor}} marker lands in the final string after substitutions.
    let out = '';
    let lastIndex = 0;
    for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
      const matchStart = match.index ?? 0;
      out += body.slice(lastIndex, matchStart);
      const token = match[1].trim();
      out += substitute(token, now, answers, () => {
        // First {{cursor}} wins — subsequent ones are ignored so authors
        // can sprinkle them without changing caret placement.
        if (cursorOffset === null) cursorOffset = out.length;
      });
      lastIndex = matchStart + match[0].length;
    }
    out += body.slice(lastIndex);

    return { body: out, cursorOffset };
  },
};

function substitute(
  token: string,
  now: Date,
  answers: Record<string, string>,
  onCursor: () => void,
): string {
  if (token === 'date') return formatDate(now);
  if (token === 'time') return formatTime(now);
  if (token === 'cursor') {
    onCursor();
    return '';
  }
  if (token.startsWith('prompt:')) {
    const question = token.slice('prompt:'.length).trim();
    return answers[question] ?? '';
  }
  // Unknown placeholder — pass through verbatim so authors notice.
  return `{{${token}}}`;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
