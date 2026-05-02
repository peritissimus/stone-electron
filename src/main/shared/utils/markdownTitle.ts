/**
 * Strip the first H1 heading (`# Title`) from a markdown string and the
 * blank lines that follow it. Mirrors the convention used by note save
 * (`UpdateNoteUseCase` prepends `# ${title}\n\n`) so reads return body-only
 * markdown ready for the editor.
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
