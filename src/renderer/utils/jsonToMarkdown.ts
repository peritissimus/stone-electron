/**
 * Simple ProseMirror JSON to Markdown converter
 * Handles the extensions used in this project
 */

interface ProseMirrorNode {
  type?: string;
  attrs?: Record<string, any>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: ProseMirrorMark[];
}

interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, any>;
}

interface ProseMirrorDoc {
  type?: string;
  content?: ProseMirrorNode[];
}

export function jsonToMarkdown(doc: ProseMirrorDoc): string {
  if (!doc.content) return '';
  return processNodes(doc.content);
}

function processNodes(nodes: ProseMirrorNode[]): string {
  return nodes.map(processNode).join('');
}

function processNode(node: ProseMirrorNode): string {
  const { type, content, text, attrs } = node;

  if (!type) return '';

  switch (type) {
    case 'heading': {
      const level = attrs?.level || 1;
      const headingText = content ? processNodes(content) : '';
      return '\n' + '#'.repeat(level) + ' ' + headingText + '\n\n';
    }

    case 'paragraph': {
      const paraText = content ? processNodes(content) : '';
      return paraText + '\n\n';
    }

    case 'text':
      return applyMarks(text || '', node.marks || []);

    case 'hardBreak':
      return '\n';

    case 'horizontalRule':
      return '\n---\n\n';

    case 'bulletList':
      return '\n' + processListItems(content || [], '- ') + '\n';

    case 'orderedList':
      return '\n' + processOrderedListItems(content || []) + '\n';

    case 'taskList':
      return '\n' + processTaskListItems(content || []) + '\n';

    case 'taskItem':
      return processTaskItem(node);

    case 'listItem':
      return processListItems(content || [], '');

    case 'codeBlock': {
      const language = attrs?.language || '';
      const codeContent = content ? processNodes(content) : '';
      return '\n```' + language + '\n' + codeContent + '\n```\n\n';
    }

    case 'blockquote': {
      const quoteContent = content ? processNodes(content) : '';
      return '\n> ' + quoteContent.replace(/\n/g, '\n> ') + '\n\n';
    }

    case 'table':
      return processTable(content || []);

    case 'tableRow':
      return processTableRow(content || []);

    case 'tableCell':
    case 'tableHeader': {
      const cellContent = content ? processNodes(content) : '';
      return '| ' + cellContent + ' ';
    }

    case 'noteLink': {
      // Convert note link node to [[note name]] syntax
      const noteTitle = attrs?.title || 'Unknown';
      return `[[${noteTitle}]]`;
    }

    case 'image': {
      // Convert image node to markdown image syntax
      const src = attrs?.src || '';
      const alt = attrs?.alt || '';
      const title = attrs?.title || '';
      // Convert file:// URLs to relative .assets paths for portability
      let imagePath = src;
      if (src.startsWith('file://')) {
        const assetsIndex = src.indexOf('.assets/');
        if (assetsIndex !== -1) {
          imagePath = src.substring(assetsIndex);
        }
      }
      // Format: ![alt](src "title") or ![alt](src)
      if (title) {
        return `![${alt}](${imagePath} "${title}")\n\n`;
      }
      return `![${alt}](${imagePath})\n\n`;
    }

    default:
      // For unknown node types, try to process content
      if (content) {
        return processNodes(content);
      }
      return '';
  }
}

function applyMarks(text: string, marks: ProseMirrorMark[]): string {
  let result = text;

  // Apply marks in reverse order (innermost first)
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
        const href = mark.attrs?.href || '';
        result = '[' + result + '](' + href + ')';
        break;
      }
    }
  }

  return result;
}

function processListItems(items: ProseMirrorNode[], prefix: string): string {
  return items
    .map((item) => {
      const content = item.content || [];
      let itemText = '';

      for (const child of content) {
        if (child.type === 'paragraph') {
          itemText += processNodes(child.content || []);
        } else {
          itemText += processNode(child);
        }
      }

      // Handle nested lists
      const lines = itemText.trim().split('\n');
      const firstLine = prefix + lines[0];
      const restLines = lines.slice(1).map((line) => '  ' + line);

      return [firstLine, ...restLines].join('\n');
    })
    .join('\n');
}

function processOrderedListItems(items: ProseMirrorNode[]): string {
  return items
    .map((item, index) => {
      const content = item.content || [];
      let itemText = '';

      for (const child of content) {
        if (child.type === 'paragraph') {
          itemText += processNodes(child.content || []);
        } else {
          itemText += processNode(child);
        }
      }

      // Handle nested lists
      const lines = itemText.trim().split('\n');
      const firstLine = `${index + 1}. ${lines[0]}`;
      const restLines = lines.slice(1).map((line) => '   ' + line);

      return [firstLine, ...restLines].join('\n');
    })
    .join('\n');
}

function processTaskListItems(items: ProseMirrorNode[]): string {
  return items
    .map((item) => {
      return processTaskItem(item);
    })
    .filter((item) => item.length > 0)
    .join('\n');
}

function processTaskItem(node: ProseMirrorNode): string {
  const state = node.attrs?.state || 'todo';
  const stateLabel = state.toUpperCase();
  const content = node.content || [];

  let itemText = '';
  for (const child of content) {
    if (child.type === 'paragraph') {
      itemText += processNodes(child.content || []);
    } else {
      itemText += processNode(child);
    }
  }

  // Task items are saved WITHOUT dash (dash is for regular lists)
  return `${stateLabel} ${itemText.trim()}`;
}

function processTable(rows: ProseMirrorNode[]): string {
  if (!rows.length) return '';

  const markdownRows: string[] = [];

  // Process header row
  if (rows[0]?.content) {
    const headerCells = rows[0].content
      .filter((cell) => cell.type === 'tableHeader')
      .map((cell) => {
        const content = cell.content ? processNodesForTable(cell.content) : '';
        return '| ' + content.trim() + ' ';
      });
    markdownRows.push(headerCells.join('') + '|');

    // Add separator row
    const separatorCells = rows[0].content
      .filter((cell) => cell.type === 'tableHeader')
      .map(() => '| --- ');
    markdownRows.push(separatorCells.join('') + '|');
  }

  // Process data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.content) {
      const cells = row.content
        .filter((cell) => cell.type === 'tableCell')
        .map((cell) => {
          const content = cell.content ? processNodesForTable(cell.content) : '';
          return '| ' + content.trim() + ' ';
        });
      markdownRows.push(cells.join('') + '|');
    }
  }

  return '\n' + markdownRows.join('\n') + '\n\n';
}

// Special processing for table cells - convert line breaks to spaces
function processNodesForTable(nodes: ProseMirrorNode[]): string {
  return nodes.map((node) => processNodeForTable(node)).join('');
}

function processNodeForTable(node: ProseMirrorNode): string {
  const { type, content, text } = node;

  if (!type) return '';

  switch (type) {
    case 'paragraph': {
      const paraText = content ? processNodesForTable(content) : '';
      return paraText ? paraText.trim() + ' ' : '';
    }

    case 'text':
      return applyMarks(text || '', node.marks || []);

    case 'hardBreak':
      // In table cells, convert hard breaks to spaces instead of newlines
      return ' ';

    case 'heading': {
      // In table cells, treat headings as plain text
      const headingText = content ? processNodesForTable(content) : '';
      return headingText;
    }

    case 'bulletList':
    case 'orderedList': {
      // In table cells, flatten lists to comma-separated text
      const listItems = content || [];
      const listTexts = listItems
        .map((item) => {
          const itemContent = item.content || [];
          return itemContent
            .map((child) => {
              if (child.type === 'paragraph') {
                return processNodesForTable(child.content || []);
              }
              return processNodeForTable(child);
            })
            .join('')
            .trim();
        })
        .filter((text) => text.length > 0);
      return listTexts.join(', ');
    }

    case 'listItem':
      // Handled by bulletList/orderedList above
      return processNodesForTable(content || []);

    case 'codeBlock': {
      // In table cells, treat code blocks as inline code
      const codeContent = content ? processNodesForTable(content) : '';
      return '`' + codeContent.replace(/\n/g, ' ') + '`';
    }

    case 'blockquote': {
      // In table cells, treat blockquotes as plain text
      const quoteContent = content ? processNodesForTable(content) : '';
      return quoteContent;
    }

    case 'horizontalRule':
      // Skip horizontal rules in table cells
      return '';

    case 'noteLink': {
      // Note links in table cells
      const tableCellNoteTitle = node.attrs?.title || 'Unknown';
      return `[[${tableCellNoteTitle}]]`;
    }

    default:
      // For other node types, process content recursively
      if (content) {
        return processNodesForTable(content);
      }
      return '';
  }
}

function processTableRow(_cells: ProseMirrorNode[]): string {
  // This is handled by processTable
  return '';
}
