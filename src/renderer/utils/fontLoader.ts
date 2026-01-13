import barlow400Url from '@fontsource/barlow/files/barlow-latin-400-normal.woff2?url';
import barlow600Url from '@fontsource/barlow/files/barlow-latin-600-normal.woff2?url';
import barlow700Url from '@fontsource/barlow/files/barlow-latin-700-normal.woff2?url';
import barlowSemiCondensed700Url from '@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-700-normal.woff2?url';
import inter400Url from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import inter500Url from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
import inter600Url from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import inter700Url from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import firaCode400Url from '@fontsource/fira-code/files/fira-code-latin-400-normal.woff2?url';
import firaCode500Url from '@fontsource/fira-code/files/fira-code-latin-500-normal.woff2?url';
import patrickHand400Url from '@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2?url';

interface EmbeddedFont {
  family: string;
  weight: number;
  url: string;
  style?: 'normal' | 'italic';
}

const fontDefinitions: EmbeddedFont[] = [
  { family: 'Barlow', weight: 400, url: barlow400Url },
  { family: 'Barlow', weight: 600, url: barlow600Url },
  { family: 'Barlow', weight: 700, url: barlow700Url },
  { family: 'Barlow Semi Condensed', weight: 700, url: barlowSemiCondensed700Url },
  { family: 'Inter', weight: 400, url: inter400Url },
  { family: 'Inter', weight: 500, url: inter500Url },
  { family: 'Inter', weight: 600, url: inter600Url },
  { family: 'Inter', weight: 700, url: inter700Url },
  { family: 'Fira Code', weight: 400, url: firaCode400Url },
  { family: 'Fira Code', weight: 500, url: firaCode500Url },
  { family: 'Patrick Hand', weight: 400, url: patrickHand400Url },
];

const fontCache = new Map<string, Promise<string>>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let idx = 0; idx < bytes.length; idx += chunkSize) {
    const chunk = bytes.subarray(idx, idx + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

async function loadFontBase64(url: string): Promise<string> {
  if (fontCache.has(url)) {
    return fontCache.get(url)!;
  }

  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load font: ${response.status} ${response.statusText}`);
      }
      return response.arrayBuffer();
    })
    .then((buffer) => arrayBufferToBase64(buffer));

  fontCache.set(url, promise);
  return promise;
}

export async function getEmbeddedFontFaces(): Promise<string> {
  const rules = await Promise.all(
    fontDefinitions.map(async (font) => {
      const data = await loadFontBase64(font.url);
      return `
        @font-face {
          font-family: '${font.family}';
          src: url('data:font/woff2;base64,${data}') format('woff2');
          font-weight: ${font.weight};
          font-style: ${font.style || 'normal'};
          font-display: swap;
        }
      `;
    }),
  );

  return rules.join('\n');
}
