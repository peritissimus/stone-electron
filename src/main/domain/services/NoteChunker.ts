/**
 * NoteChunker - pure domain service for splitting markdown into retrieval chunks.
 *
 * Strategy: walk the markdown line-by-line, tracking the active heading stack,
 * collect non-heading lines into "sections" (one per leaf heading scope), then
 * pack each section's paragraphs into chunks under a configured character
 * budget. Single paragraphs that exceed the budget get split at sentence
 * boundaries. Adjacent chunks overlap by a configurable suffix/prefix so the
 * downstream LLM never sees a thought sliced in half.
 *
 * Pure: no I/O, no AI SDK, no markdown library — operates only on the string
 * input and returns plain data. Chunk IDs are deterministic (`noteId:index`)
 * so re-running on identical input yields the same IDs.
 */

export interface Chunk {
  id: string;
  index: number;
  headingPath: string[];
  text: string;
  tokenCount: number;
}

export interface ChunkOptions {
  /** Soft upper bound for a single chunk's character length. */
  maxChars: number;
  /** Characters of overlap prepended to the next chunk from the prior one. */
  overlapChars: number;
  /** Don't emit chunks below this size unless it's the final remainder. */
  minChars: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChars: 1800,
  overlapChars: 180,
  minChars: 200,
};

interface PendingSection {
  headingPath: string[];
  lines: string[];
}

export class NoteChunker {
  /**
   * Split markdown into chunks for retrieval indexing.
   *
   * @param noteId stable note identifier; chunk IDs derive from it
   * @param markdown raw note body
   * @param opts override default chunk budget / overlap
   */
  static chunk(noteId: string, markdown: string, opts: Partial<ChunkOptions> = {}): Chunk[] {
    const options: ChunkOptions = { ...DEFAULT_OPTIONS, ...opts };
    const normalized = stripFrontmatter(markdown).replace(/\r\n/g, '\n');
    if (!normalized.trim()) return [];

    const sections = collectSections(normalized);
    if (sections.length === 0) return [];

    const chunks: Chunk[] = [];
    let nextIndex = 0;

    for (const section of sections) {
      const sectionText = section.lines.join('\n').trim();
      if (!sectionText) continue;

      const paragraphs = splitParagraphs(sectionText);
      const packed = packIntoChunks(paragraphs, options);

      for (const text of packed) {
        chunks.push({
          id: `${noteId}:${nextIndex}`,
          index: nextIndex,
          headingPath: [...section.headingPath],
          text,
          tokenCount: estimateTokens(text),
        });
        nextIndex += 1;
      }
    }

    // Coalesce a final tiny chunk into the previous one when possible — gives
    // the LLM a more useful trailing context window instead of a 1-line orphan.
    if (chunks.length >= 2) {
      const last = chunks[chunks.length - 1];
      const prev = chunks[chunks.length - 2];
      if (
        last.text.length < options.minChars &&
        last.headingPath.join('|') === prev.headingPath.join('|') &&
        prev.text.length + last.text.length + 2 <= options.maxChars
      ) {
        prev.text = `${prev.text}\n\n${last.text}`;
        prev.tokenCount = estimateTokens(prev.text);
        chunks.pop();
      }
    }

    return chunks;
  }
}

/* ---------- helpers ---------- */

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---\n')) return markdown;
  const end = markdown.indexOf('\n---', 4);
  if (end === -1) return markdown;
  return markdown.slice(end + 4).replace(/^\n+/, '');
}

function collectSections(markdown: string): PendingSection[] {
  const sections: PendingSection[] = [];
  let current: PendingSection = { headingPath: [], lines: [] };
  const headingStack: { level: number; text: string }[] = [];
  let inFence = false;
  let fenceMarker = '';

  const flush = () => {
    if (current.lines.some((l) => l.trim().length > 0)) {
      sections.push(current);
    }
  };

  const lines = markdown.split('\n');
  for (const line of lines) {
    // Track fenced code blocks so we don't treat their `#` lines as headings.
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fenceMatch[1];
      } else if (line.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = '';
      }
      current.lines.push(line);
      continue;
    }

    if (!inFence) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (headingMatch) {
        flush();
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
          headingStack.pop();
        }
        headingStack.push({ level, text });
        current = {
          headingPath: headingStack.map((h) => h.text),
          lines: [],
        };
        continue;
      }
    }

    current.lines.push(line);
  }
  flush();

  return sections;
}

function splitParagraphs(text: string): string[] {
  const paragraphs: string[] = [];
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed) paragraphs.push(trimmed);
  }
  return paragraphs;
}

function packIntoChunks(paragraphs: string[], opts: ChunkOptions): string[] {
  const out: string[] = [];
  let buffer = '';

  const flush = () => {
    const text = buffer.trim();
    if (text) out.push(text);
    buffer = '';
  };

  for (const para of paragraphs) {
    if (para.length > opts.maxChars) {
      flush();
      for (const sentence of splitOversizedParagraph(para, opts.maxChars)) {
        out.push(sentence);
      }
      continue;
    }

    const tentative = buffer ? `${buffer}\n\n${para}` : para;
    if (tentative.length <= opts.maxChars) {
      buffer = tentative;
    } else {
      flush();
      buffer = para;
    }
  }
  flush();

  if (opts.overlapChars > 0 && out.length > 1) {
    return applyOverlap(out, opts.overlapChars);
  }
  return out;
}

function splitOversizedParagraph(paragraph: string, maxChars: number): string[] {
  // Split on sentence boundaries, then re-pack into chunks ≤ maxChars.
  const sentences = paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z([])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return hardSplit(paragraph, maxChars);

  const out: string[] = [];
  let buffer = '';
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (buffer) {
        out.push(buffer.trim());
        buffer = '';
      }
      for (const piece of hardSplit(sentence, maxChars)) out.push(piece);
      continue;
    }
    const tentative = buffer ? `${buffer} ${sentence}` : sentence;
    if (tentative.length <= maxChars) {
      buffer = tentative;
    } else {
      out.push(buffer.trim());
      buffer = sentence;
    }
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out;
}

function hardSplit(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    out.push(text.slice(i, i + maxChars));
  }
  return out;
}

function applyOverlap(chunks: string[], overlap: number): string[] {
  const out: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i += 1) {
    const prev = chunks[i - 1];
    const tail = prev.slice(Math.max(0, prev.length - overlap));
    out.push(`${tail}\n${chunks[i]}`);
  }
  return out;
}

function estimateTokens(text: string): number {
  // Rough heuristic — 4 characters per token. The exact tokenizer depends on
  // the model; this is good enough for budgeting prompt size.
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
