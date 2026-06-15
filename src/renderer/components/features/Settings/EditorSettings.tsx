/**
 * EditorSettings — Settings → Editor. Editor behaviour and in-editor visual
 * options, split out of Appearance so "Appearance" stays about look (theme,
 * accent, fonts) and editor preferences have their own home.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import { Switch } from '@renderer/components/base/ui/switch';
import { Label, Body } from '@renderer/components/base/ui/text';
import { ContainerStack, Separator } from '@renderer/components/base/ui';
import { useEditorUI } from '@renderer/hooks/useUI';
import { SettingsSection } from './SettingsSection';

export function EditorSettings() {
  const { editorMode, setEditorMode, showBlockIndicators, toggleBlockIndicators } = useEditorUI();

  return (
    <SettingsSection title="Editor" description="How notes open and render in the editor.">
      <ContainerStack gap="lg">
        <ContainerStack gap="sm">
          <Label>Editor mode</Label>
          <Select value={editorMode} onValueChange={(value) => setEditorMode(value as typeof editorMode)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rich">Rich text</SelectItem>
              <SelectItem value="raw">Raw Markdown</SelectItem>
            </SelectContent>
          </Select>
          <Body size="xs" variant="muted">
            How notes open by default. Toggle per note with the editor mode shortcut.
          </Body>
        </ContainerStack>

        <Separator />

        <ContainerStack gap="sm">
          <Label>Visual options</Label>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Body size="sm">Block indicators</Body>
              <Body size="xs" variant="muted">
                Show bullet markers on the left of blocks
              </Body>
            </div>
            <Switch checked={showBlockIndicators} onCheckedChange={toggleBlockIndicators} />
          </div>
        </ContainerStack>
      </ContainerStack>
    </SettingsSection>
  );
}
