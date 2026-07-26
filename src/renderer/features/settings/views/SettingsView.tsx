import type { ReactNode } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import {
  Pulse,
  Brain,
  Database,
  GitBranch,
  Info,
  Keyboard,
  Microphone,
  Palette,
  PencilSimple,
  PuzzlePiece,
} from '@phosphor-icons/react';
import { ScrollArea } from '@renderer/components/base/ui';
import { ViewHeader } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';
import { toSettings } from '@renderer/services/navigation/routes';
import { AboutSettings } from '@renderer/features/settings/views/components/AboutSettings';
import { AISettings } from '@renderer/features/settings/views/components/AISettings';
import { AppearanceSettings } from '@renderer/features/settings/views/components/AppearanceSettings';
import { EditorSettings } from '@renderer/features/settings/views/components/EditorSettings';
import { IntegrationsSettings } from '@renderer/features/settings/views/components/IntegrationsSettings';
import { DatabaseSettings } from '@renderer/features/settings/views/components/DatabaseSettings';
import { GitSettings } from '@renderer/features/settings/views/components/GitSettings';
import { KeyboardShortcutsSettings } from '@renderer/features/settings/views/components/KeyboardShortcutsSettings';
import { PerformanceSettings } from '@renderer/features/settings/views/components/PerformanceSettings';
import { RecordingSettings } from '@renderer/features/settings/views/components/RecordingSettings';

type SettingsSectionId =
  | 'appearance'
  | 'editor'
  | 'shortcuts'
  | 'recording'
  | 'ai'
  | 'integrations'
  | 'git'
  | 'database'
  | 'performance'
  | 'about';

interface SettingsSectionDef {
  id: SettingsSectionId;
  label: string;
  icon: ReactNode;
  element: ReactNode;
}

interface SettingsGroup {
  label: string;
  items: SettingsSectionDef[];
}

const GROUPS: SettingsGroup[] = [
  {
    label: 'General',
    items: [
      {
        id: 'appearance',
        label: 'Appearance',
        icon: <Palette size={16} />,
        element: <AppearanceSettings />,
      },
      {
        id: 'editor',
        label: 'Editor',
        icon: <PencilSimple size={16} />,
        element: <EditorSettings />,
      },
      {
        id: 'shortcuts',
        label: 'Shortcuts',
        icon: <Keyboard size={16} />,
        element: <KeyboardShortcutsSettings />,
      },
    ],
  },
  {
    label: 'Capture & AI',
    items: [
      {
        id: 'recording',
        label: 'Recording',
        icon: <Microphone size={16} />,
        element: <RecordingSettings />,
      },
      { id: 'ai', label: 'AI', icon: <Brain size={16} />, element: <AISettings /> },
    ],
  },
  {
    label: 'Data & Sync',
    items: [
      {
        id: 'integrations',
        label: 'Integrations',
        icon: <PuzzlePiece size={16} />,
        element: <IntegrationsSettings />,
      },
      { id: 'git', label: 'Sync', icon: <GitBranch size={16} />, element: <GitSettings /> },
      {
        id: 'database',
        label: 'Database',
        icon: <Database size={16} />,
        element: <DatabaseSettings />,
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        id: 'performance',
        label: 'Performance',
        icon: <Pulse size={16} />,
        element: <PerformanceSettings />,
      },
      { id: 'about', label: 'About', icon: <Info size={16} />, element: <AboutSettings /> },
    ],
  },
];

const SECTIONS: SettingsSectionDef[] = GROUPS.flatMap((group) => group.items);

function isSettingsSectionId(value: string | undefined): value is SettingsSectionId {
  return SECTIONS.some((section) => section.id === value);
}

export default function SettingsView() {
  const { section } = useParams<{ section?: string }>();

  if (!section) {
    return <Navigate to={toSettings('appearance')} replace />;
  }

  if (!isSettingsSectionId(section)) {
    return <Navigate to={toSettings('appearance')} replace />;
  }

  const activeSection = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ViewHeader title="Settings" />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 border-r border-border/50 bg-muted/[0.035] md:flex md:flex-col">
          <nav className="flex flex-col gap-5 px-3 py-5">
            {GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <span className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/60">
                  {group.label}
                </span>
                {group.items.map((item) => (
                  <NavLink
                    key={item.id}
                    to={toSettings(item.id)}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px]',
                        'transition-[background-color,color,transform] duration-150 ease-out',
                        'active:scale-[0.98]',
                        isActive
                          ? 'bg-secondary/80 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.25)]'
                          : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center',
                            isActive ? 'text-primary' : 'text-muted-foreground/80',
                          )}
                        >
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border px-4 py-3 md:hidden">
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-1">
                {SECTIONS.map((item) => (
                  <NavLink
                    key={item.id}
                    to={toSettings(item.id)}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border px-2 text-xs',
                        'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]',
                        isActive
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </ScrollArea>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <main className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-10">
              {activeSection.element}
            </main>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
