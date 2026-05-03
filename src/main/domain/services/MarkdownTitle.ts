/**
 * Markdown title helpers.
 *
 * Pure note-content transformations used by use cases that expose editor body
 * markdown separately from a note's title.
 */
export function stripFirstHeading(markdown: string): string {
  const lines = markdown.split('\n');
  let foundHeading = false;
  const result: string[] = [];

  for (const line of lines) {
    if (!foundHeading && /^#\s+.+$/.test(line)) {
      foundHeading = true;
      continue;
    }
    result.push(line);
  }

  while (result.length > 0 && result[0].trim() === '') {
    result.shift();
  }

  return result.join('\n');
}
