/**
 * renderMarkdown — render trusted markdown (e.g. AI-generated meeting summaries)
 * to HTML for display inside a `prose`-styled container.
 *
 * A plain markdown-it instance with `html: false` so any raw HTML in the source
 * is escaped (no injection), separate from the editor's parser so its custom
 * plugins (task markers, timestamps, note links) don't transform summary text.
 */

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

export function renderMarkdown(source: string): string {
  return md.render(source);
}
