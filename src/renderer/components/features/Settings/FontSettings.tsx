/**
 * Font Settings Component
 * Allows users to customize fonts for UI, editor headings, editor body, and code
 */

import { useUIStore } from '@renderer/stores/uiStore';
import { Label, Body } from '@renderer/components/base/ui/text';
import { Slider } from '@renderer/components/base/ui/slider';
import { Button } from '@renderer/components/base/ui/button';
import { ContainerStack } from '@renderer/components/base/ui';
import { ArrowCounterClockwise } from 'phosphor-react';
import { FontPicker } from './FontPicker';

export function FontSettings() {
  const { fontSettings, setFontSettings, resetFontSettings } = useUIStore();

  return (
    <ContainerStack gap="lg">
      {/* Reset Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={resetFontSettings}>
          <ArrowCounterClockwise size={14} className="mr-2" />
          Reset to Defaults
        </Button>
      </div>

      {/* UI Font */}
      <ContainerStack gap="sm">
        <Label>Interface Font</Label>
        <FontPicker
          value={fontSettings.uiFont}
          onValueChange={(value) => setFontSettings({ uiFont: value })}
          placeholder="Select interface font"
        />
        <Body variant="muted" size="sm">
          Used for sidebars, menus, and buttons
        </Body>
      </ContainerStack>

      {/* UI Font Size */}
      <ContainerStack gap="sm">
        <div className="flex justify-between">
          <Label>Interface Font Size</Label>
          <Body variant="muted" size="sm">
            {fontSettings.uiFontSize}px
          </Body>
        </div>
        <Slider
          min={11}
          max={16}
          step={1}
          value={[fontSettings.uiFontSize]}
          onValueChange={([value]) => setFontSettings({ uiFontSize: value })}
        />
      </ContainerStack>

      {/* Editor Heading Font */}
      <ContainerStack gap="sm">
        <Label>Editor Heading Font</Label>
        <FontPicker
          value={fontSettings.editorHeadingFont}
          onValueChange={(value) => setFontSettings({ editorHeadingFont: value })}
          placeholder="Select heading font"
        />
        <Body variant="muted" size="sm">
          Used for h1-h6 headings in notes
        </Body>
      </ContainerStack>

      {/* Editor Body Font */}
      <ContainerStack gap="sm">
        <Label>Editor Body Font</Label>
        <FontPicker
          value={fontSettings.editorBodyFont}
          onValueChange={(value) => setFontSettings({ editorBodyFont: value })}
          placeholder="Select body font"
        />
        <Body variant="muted" size="sm">
          Used for paragraphs and lists in notes
        </Body>
      </ContainerStack>

      {/* Editor Font Size */}
      <ContainerStack gap="sm">
        <div className="flex justify-between">
          <Label>Editor Font Size</Label>
          <Body variant="muted" size="sm">
            {fontSettings.editorFontSize}px
          </Body>
        </div>
        <Slider
          min={12}
          max={24}
          step={1}
          value={[fontSettings.editorFontSize]}
          onValueChange={([value]) => setFontSettings({ editorFontSize: value })}
        />
      </ContainerStack>

      {/* Editor Line Height */}
      <ContainerStack gap="sm">
        <div className="flex justify-between">
          <Label>Editor Line Height</Label>
          <Body variant="muted" size="sm">
            {fontSettings.editorLineHeight.toFixed(2)}
          </Body>
        </div>
        <Slider
          min={1.2}
          max={2.4}
          step={0.05}
          value={[fontSettings.editorLineHeight]}
          onValueChange={([value]) => setFontSettings({ editorLineHeight: value })}
        />
      </ContainerStack>

      {/* Monospace Font */}
      <ContainerStack gap="sm">
        <Label>Code Font</Label>
        <FontPicker
          value={fontSettings.monoFont}
          onValueChange={(value) => setFontSettings({ monoFont: value })}
          placeholder="Select code font"
        />
        <Body variant="muted" size="sm">
          Used for code blocks and inline code
        </Body>
      </ContainerStack>

      {/* Monospace Font Size */}
      <ContainerStack gap="sm">
        <div className="flex justify-between">
          <Label>Code Font Size</Label>
          <Body variant="muted" size="sm">
            {fontSettings.monoFontSize}px
          </Body>
        </div>
        <Slider
          min={10}
          max={18}
          step={1}
          value={[fontSettings.monoFontSize]}
          onValueChange={([value]) => setFontSettings({ monoFontSize: value })}
        />
      </ContainerStack>
    </ContainerStack>
  );
}
