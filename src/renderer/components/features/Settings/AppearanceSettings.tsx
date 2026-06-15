import { useTheme, ACCENT_COLORS, type AccentColor } from '@renderer/hooks/useUI';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import { Label } from '@renderer/components/base/ui/text';
import { ContainerStack, Separator } from '@renderer/components/base/ui';
import { SettingsSection } from './SettingsSection';
import { FontSettings } from './FontSettings';
import { FontPreview } from './FontPreview';

export function AppearanceSettings() {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();

  return (
    <SettingsSection title="Appearance" description="Theme, accent color, and fonts.">

      <ContainerStack gap="lg">
        <ContainerStack gap="sm">
          <Label>Theme</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </ContainerStack>

        <ContainerStack gap="sm">
          <Label>Accent Color</Label>
          <AccentColorPicker value={accentColor} onChange={setAccentColor} />
        </ContainerStack>

        <Separator />

        <FontSettings />

        <Separator />

        <FontPreview />
      </ContainerStack>
    </SettingsSection>
  );
}

interface AccentColorPickerProps {
  value: AccentColor;
  onChange: (color: AccentColor) => void;
}

function AccentColorPicker({ value, onChange }: AccentColorPickerProps) {
  const colors = Object.entries(ACCENT_COLORS) as [AccentColor, { name: string; hue: number }][];

  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(([key, { name, hue }]) => (
        <button
          type="button"
          key={key}
          onClick={() => onChange(key)}
          className={`w-8 h-8 rounded-full transition-[box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95 ${
            value === key
              ? 'ring-2 ring-offset-2 ring-offset-popover ring-foreground scale-110'
              : 'hover:scale-105'
          }`}
          style={{ backgroundColor: `hsl(${hue} 70% 50%)` }}
          title={name}
          aria-label={`Select ${name} accent color`}
        />
      ))}
    </div>
  );
}
