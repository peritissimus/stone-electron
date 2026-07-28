/**
 * Browser-side delivery for note export.
 *
 * The desktop app writes the file itself after a save dialog. A server must not
 * write to the viewer's disk, so it returns the rendered document and the
 * browser hands it to the person — a download for HTML/Markdown, and the print
 * dialog for PDF (which is also how the browser makes a PDF at all).
 */

const safeFileName = (title: string, extension: string): string => {
  const base = title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'note';
  return `${base}.${extension}`;
};

function triggerDownload(content: string, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadHtml(html: string, title: string): void {
  triggerDownload(html, safeFileName(title, 'html'), 'text/html;charset=utf-8');
}

export function downloadMarkdown(markdown: string, title: string): void {
  triggerDownload(markdown, safeFileName(title, 'md'), 'text/markdown;charset=utf-8');
}

/**
 * Opens the document in a hidden frame and prints it, letting the person choose
 * "Save as PDF". Printing a frame rather than the page keeps the app's own
 * styles out of the output.
 */
export function printAsPdf(html: string): void {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.append(frame);

  const cleanup = () => frame.remove();

  frame.addEventListener('load', () => {
    const view = frame.contentWindow;
    if (!view) {
      cleanup();
      return;
    }
    view.addEventListener('afterprint', cleanup, { once: true });
    view.focus();
    view.print();
    // Safari never fires afterprint for a frame; drop it on a timer instead.
    setTimeout(cleanup, 60_000);
  });

  frame.srcdoc = html;
}
