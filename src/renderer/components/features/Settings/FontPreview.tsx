/**
 * Font Preview Component
 * Live preview of font settings showing headings, body text, and code
 */

import { useUIStore } from '@renderer/stores/uiStore';
import { ContainerStack } from '@renderer/components/base/ui';
import { Body } from '@renderer/components/base/ui/text';

export function FontPreview() {
  const { fontSettings } = useUIStore();

  return (
    <ContainerStack gap="md" className="border border-border rounded-lg p-4 bg-card">
      <Body variant="muted" size="sm" className="uppercase tracking-wide">
        Preview
      </Body>

      <div
        className="space-y-3"
        style={{
          fontFamily: fontSettings.editorBodyFont,
          fontSize: `${fontSettings.editorFontSize}px`,
          lineHeight: fontSettings.editorLineHeight,
        }}
      >
        {/* Headings */}
        <h1
          className="text-4xl font-bold text-foreground"
          style={{ fontFamily: fontSettings.editorHeadingFont }}
        >
          Heading 1
        </h1>
        <h2
          className="text-3xl font-bold text-foreground"
          style={{ fontFamily: fontSettings.editorHeadingFont }}
        >
          Heading 2
        </h2>
        <h3
          className="text-2xl font-semibold text-foreground"
          style={{ fontFamily: fontSettings.editorHeadingFont }}
        >
          Heading 3
        </h3>

        {/* Body text */}
        <p className="text-foreground">
          This is body text in the selected font. It demonstrates how your content will appear with
          the current font settings. The quick brown fox jumps over the lazy dog.
        </p>

        {/* List */}
        <ul className="list-disc list-inside text-foreground">
          <li>First list item</li>
          <li>Second list item</li>
          <li>Third list item</li>
        </ul>

        {/* Inline code */}
        <p className="text-foreground">
          Here's some{' '}
          <code
            className="px-2 py-1 rounded bg-muted text-foreground font-mono text-sm"
            style={{
              fontFamily: fontSettings.monoFont,
              fontSize: `${fontSettings.monoFontSize}px`,
            }}
          >
            inline code
          </code>{' '}
          in a sentence.
        </p>

        {/* Code block */}
        <pre
          className="p-4 rounded-lg bg-muted overflow-x-auto"
          style={{
            fontFamily: fontSettings.monoFont,
            fontSize: `${fontSettings.monoFontSize}px`,
          }}
        >
          <code className="text-foreground">{`function example() {
  return "Code block preview";
}`}</code>
        </pre>
      </div>
    </ContainerStack>
  );
}
