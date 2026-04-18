import { toPng } from 'html-to-image';

interface DownloadOptions {
  fileName?: string;
  filterSelectors?: string[];
  style?: Partial<CSSStyleDeclaration>;
}

/**
 * Convert an element to PNG and trigger a download.
 */
export async function downloadElementAsPng(
  element: HTMLElement,
  {
    fileName = 'code-block.png',
    filterSelectors = [],
    style = { margin: '0' },
  }: DownloadOptions = {},
) {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: Math.max(window.devicePixelRatio, 2),
    style,
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      return !filterSelectors.some((selector) => node.matches(selector));
    },
  });

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
