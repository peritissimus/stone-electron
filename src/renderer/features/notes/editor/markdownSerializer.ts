/**
 * Markdown Serializer
 *
 * Converts ProseMirror JSON document structure directly to markdown text.
 *
 * Handles all custom nodes:
 * - Task markers (TODO, DOING, DONE, etc.)
 * - Timestamps [HH:MM]
 * - Note links [[title]]
 * - Task items (Logseq-style)
 * - Tables
 * - Code blocks
 * - Images
 */

interface ProseMirrorNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: ProseMirrorMark[];
}

interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface ProseMirrorDoc {
  type?: string;
  content?: ProseMirrorNode[];
}

interface SerializerState {
  // Append into an array and `.join('')` once at the end. `a += b` on a
  // string reallocates the whole buffer on every call — for a 1 MB result
  // built from ~100k small writes that's O(N²) and costs ~10s. Array push
  // + single join is O(N).
  parts: string[];
  closed: boolean;
  inTightList: boolean;
  listIndent: number;
  inTable: boolean;
}

export function serializeMarkdown(doc: ProseMirrorDoc): string {
  if (!doc.content) return '';

  const state: SerializerState = {
    parts: [],
    closed: false,
    inTightList: false,
    listIndent: 0,
    inTable: false,
  };

  processNodes(doc.content, state);

  return state.parts
    .join('')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function write(state: SerializerState, text: string) {
  if (!text) return;
  state.parts.push(text);
  state.closed = false;
}

function ensureNewline(state: SerializerState) {
  if (state.parts.length === 0) return;
  const last = state.parts[state.parts.length - 1];
  if (!last.endsWith('\n')) state.parts.push('\n');
}

function closeBlock(state: SerializerState) {
  if (!state.closed) {
    ensureNewline(state);
    state.closed = true;
  }
}

function processNodes(nodes: ProseMirrorNode[], state: SerializerState): void {
  for (const node of nodes) {
    processNode(node, state);
  }
}

function processNode(node: ProseMirrorNode, state: SerializerState): void {
  const { type, content, text, attrs } = node;

  if (!type) return;

  switch (type) {
    case 'heading': {
      closeBlock(state);
      const level = (attrs?.level as number) || 1;
      write(state, '#'.repeat(level) + ' ');
      if (content) processInlineNodes(content, state);
      write(state, '\n\n');
      state.closed = true;
      break;
    }

    case 'paragraph': {
      if (state.listIndent === 0) {
        closeBlock(state);
      }
      if (content) processInlineNodes(content, state);
      if (state.listIndent === 0) {
        write(state, '\n\n');
        state.closed = true;
      }
      break;
    }

    case 'text':
      write(state, applyMarks(text || '', node.marks || []));
      break;

    case 'hardBreak':
      write(state, '\n');
      break;

    case 'horizontalRule':
      closeBlock(state);
      write(state, '---\n\n');
      state.closed = true;
      break;

    case 'bulletList':
      if (state.listIndent === 0) {
        closeBlock(state);
      }
      if (content) {
        for (const item of content) {
          processListItem(item, state, '- ');
        }
      }
      if (state.listIndent === 0) {
        write(state, '\n');
      }
      break;

    case 'orderedList': {
      if (state.listIndent === 0) {
        closeBlock(state);
      }
      const start = (attrs?.start as number) || 1;
      if (content) {
        content.forEach((item, index) => {
          processListItem(item, state, `${start + index}. `);
        });
      }
      if (state.listIndent === 0) {
        write(state, '\n');
      }
      break;
    }

    case 'taskList':
      if (state.listIndent === 0) {
        closeBlock(state);
      }
      if (content) {
        for (const item of content) {
          processTaskItem(item, state);
        }
      }
      if (state.listIndent === 0) {
        write(state, '\n');
      }
      break;

    case 'taskItem':
      processTaskItem(node, state);
      break;

    case 'listItem':
      break;

    case 'codeBlock': {
      closeBlock(state);
      const language = (attrs?.language as string) || '';
      write(state, '```' + language + '\n');
      if (content) {
        for (const child of content) {
          if (child.type === 'text') {
            write(state, child.text || '');
          }
        }
      }
      ensureNewline(state);
      write(state, '```\n\n');
      state.closed = true;
      break;
    }

    case 'blockquote': {
      closeBlock(state);
      if (content) {
        // Recursively serialize into a fresh parts buffer so we can
        // prefix each resulting line with `> `. Restore the outer buffer
        // before continuing.
        const outerParts = state.parts;
        state.parts = [];
        processNodes(content, state);
        const quoteContent = state.parts.join('').trim();
        state.parts = outerParts;

        const lines = quoteContent.split('\n');
        for (const line of lines) {
          write(state, '> ' + line + '\n');
        }
      }
      write(state, '\n');
      state.closed = true;
      break;
    }

    case 'table':
      closeBlock(state);
      state.inTable = true;
      if (content) {
        processTable(content, state);
      }
      state.inTable = false;
      write(state, '\n');
      state.closed = true;
      break;

    case 'noteLink': {
      const title = (attrs?.title as string) || 'Unknown';
      write(state, `[[${title}]]`);
      break;
    }

    case 'timestamp': {
      const time = (attrs?.time as string) || '00:00';
      write(state, `[${time}]`);
      break;
    }

    case 'taskMarker': {
      const markerState = (attrs?.state as string) || 'todo';
      write(state, markerState.toUpperCase());
      break;
    }

    case 'image': {
      const src = (attrs?.src as string) || '';
      const alt = (attrs?.alt as string) || '';
      const title = (attrs?.title as string) || '';
      let imagePath = src;
      if (src.startsWith('file://')) {
        const assetsIndex = src.indexOf('.assets/');
        if (assetsIndex !== -1) {
          imagePath = src.substring(assetsIndex);
        }
      }
      if (title) {
        write(state, `![${alt}](${imagePath} "${title}")`);
      } else {
        write(state, `![${alt}](${imagePath})`);
      }
      break;
    }

    default:
      if (content) {
        processNodes(content, state);
      }
      break;
  }
}

function processInlineNodes(nodes: ProseMirrorNode[], state: SerializerState): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        write(state, applyMarks(node.text || '', node.marks || []));
        break;
      case 'hardBreak':
        write(state, '\n');
        break;
      case 'noteLink':
      case 'timestamp':
      case 'taskMarker':
      case 'image':
        processNode(node, state);
        break;
      default:
        if (node.content) {
          processInlineNodes(node.content, state);
        }
        break;
    }
  }
}

function processListItem(node: ProseMirrorNode, state: SerializerState, prefix: string): void {
  const indent = '  '.repeat(state.listIndent);
  write(state, indent + prefix);

  state.listIndent++;
  const content = node.content || [];

  let lastChildWasList = false;
  for (let i = 0; i < content.length; i++) {
    const child = content[i];
    if (child.type === 'paragraph') {
      if (child.content) {
        processInlineNodes(child.content, state);
      }
      const nextChild = content[i + 1];
      if (
        nextChild &&
        nextChild.type !== 'bulletList' &&
        nextChild.type !== 'orderedList' &&
        nextChild.type !== 'taskList'
      ) {
        write(state, '\n');
      }
      lastChildWasList = false;
    } else if (
      child.type === 'bulletList' ||
      child.type === 'orderedList' ||
      child.type === 'taskList'
    ) {
      write(state, '\n');
      processNode(child, state);
      lastChildWasList = true;
    } else {
      processNode(child, state);
      lastChildWasList = false;
    }
  }

  state.listIndent--;
  if (!lastChildWasList) {
    write(state, '\n');
  }
}

function processTaskItem(node: ProseMirrorNode, state: SerializerState): void {
  const taskState = (node.attrs?.state as string) || 'todo';
  const stateLabel = taskState.toUpperCase();

  const indent = '  '.repeat(state.listIndent);
  write(state, indent + stateLabel + ' ');

  const content = node.content || [];
  for (const child of content) {
    if (child.type === 'paragraph') {
      if (child.content) {
        processInlineNodes(child.content, state);
      }
    } else {
      processNode(child, state);
    }
  }

  write(state, '\n');
}

function processTable(rows: ProseMirrorNode[], state: SerializerState): void {
  if (!rows.length) return;

  const headerRow = rows[0];
  if (headerRow?.content) {
    const headerCells: string[] = [];
    for (const cell of headerRow.content) {
      if (cell.type === 'tableHeader' || cell.type === 'tableCell') {
        headerCells.push(getCellContent(cell));
      }
    }
    write(state, '| ' + headerCells.join(' | ') + ' |\n');
    write(state, '| ' + headerCells.map(() => '---').join(' | ') + ' |\n');
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row?.content) {
      const cells: string[] = [];
      for (const cell of row.content) {
        if (cell.type === 'tableCell' || cell.type === 'tableHeader') {
          cells.push(getCellContent(cell));
        }
      }
      write(state, '| ' + cells.join(' | ') + ' |\n');
    }
  }
}

function getCellContent(cell: ProseMirrorNode): string {
  if (!cell.content) return '';

  const parts: string[] = [];
  for (const child of cell.content) {
    if (child.type === 'paragraph') {
      if (child.content) {
        parts.push(getInlineContent(child.content));
      }
    } else if (child.type === 'text') {
      parts.push(applyMarks(child.text || '', child.marks || []));
    }
  }

  return parts.join(' ').replace(/\n/g, ' ').trim();
}

function getInlineContent(nodes: ProseMirrorNode[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        parts.push(applyMarks(node.text || '', node.marks || []));
        break;
      case 'hardBreak':
        parts.push(' ');
        break;
      case 'noteLink':
        parts.push(`[[${(node.attrs?.title as string) || 'Unknown'}]]`);
        break;
      case 'timestamp':
        parts.push(`[${(node.attrs?.time as string) || '00:00'}]`);
        break;
      case 'taskMarker':
        parts.push(((node.attrs?.state as string) || 'todo').toUpperCase() + ' ');
        break;
      default:
        if (node.content) {
          parts.push(getInlineContent(node.content));
        }
        break;
    }
  }
  return parts.join('');
}

function applyMarks(text: string, marks: ProseMirrorMark[]): string {
  if (!marks.length) return text;

  let result = text;

  const sortedMarks = [...marks].reverse();

  for (const mark of sortedMarks) {
    switch (mark.type) {
      case 'bold':
      case 'strong':
        result = '**' + result + '**';
        break;
      case 'italic':
      case 'em':
        result = '*' + result + '*';
        break;
      case 'code':
        result = '`' + result + '`';
        break;
      case 'strike':
        result = '~~' + result + '~~';
        break;
      case 'highlight':
        result = '==' + result + '==';
        break;
      case 'link': {
        const href = (mark.attrs?.href as string) || '';
        result = '[' + result + '](' + href + ')';
        break;
      }
    }
  }

  return result;
}
