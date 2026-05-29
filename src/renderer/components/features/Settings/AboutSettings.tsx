import { ContainerStack } from '@renderer/components/base/ui';
import { SettingsSection } from './SettingsSection';

const APP_VERSION = '0.3.3';

const STACK_ROWS: Array<{ label: string; value: string }> = [
  { label: 'Runtime', value: 'Electron + Vite' },
  { label: 'UI', value: 'React + TypeScript' },
  { label: 'Storage', value: 'libsql (SQLite) + Drizzle' },
  { label: 'Editor', value: 'TipTap' },
  { label: 'Styling', value: 'Tailwind CSS' },
  { label: 'State', value: 'Zustand' },
];

export function AboutSettings() {
  return (
    <SettingsSection
      title="About Stone"
      description="A local-first note-taking app for a single user. Notes live as Markdown on disk; Git is the sanctioned multi-device path."
    >
      <ContainerStack gap="lg">
        <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-card/40 px-4 py-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-semibold tracking-tight text-primary"
            aria-hidden
          >
            St
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">Stone</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              Version {APP_VERSION}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Stack
          </div>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 text-sm">
            {STACK_ROWS.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </ContainerStack>
    </SettingsSection>
  );
}
