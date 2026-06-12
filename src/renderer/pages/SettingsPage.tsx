import type { ReactNode } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import {
  Pulse,
  Brain,
  CaretRight,
  Database,
  Gear,
  GitBranch,
  Info,
  Keyboard,
  Palette,
} from '@phosphor-icons/react';
import { ScrollArea } from '@renderer/components/base/ui';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { toSettings } from '@renderer/navigation/routes';
import { AboutSettings } from '@renderer/components/features/Settings/AboutSettings';
import { AISettings } from '@renderer/components/features/Settings/AISettings';
import { AppearanceSettings } from '@renderer/components/features/Settings/AppearanceSettings';
import { DatabaseSettings } from '@renderer/components/features/Settings/DatabaseSettings';
import { GitSettings } from '@renderer/components/features/Settings/GitSettings';
import { KeyboardShortcutsSettings } from '@renderer/components/features/Settings/KeyboardShortcutsSettings';
import { PerformanceSettings } from '@renderer/components/features/Settings/PerformanceSettings';

type SettingsSectionId =
  | 'appearance'
  | 'ai'
  | 'shortcuts'
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

const SECTIONS: SettingsSectionDef[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: <Palette size={16} />,
    element: <AppearanceSettings />,
  },
  {
    id: 'ai',
    label: 'AI',
    icon: <Brain size={16} />,
    element: <AISettings />,
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: <Keyboard size={16} />,
    element: <KeyboardShortcutsSettings />,
  },
  {
    id: 'git',
    label: 'Git Sync',
    icon: <GitBranch size={16} />,
    element: <GitSettings />,
  },
  {
    id: 'database',
    label: 'Database',
    icon: <Database size={16} />,
    element: <DatabaseSettings />,
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: <Pulse size={16} />,
    element: <PerformanceSettings />,
  },
  {
    id: 'about',
    label: 'About',
    icon: <Info size={16} />,
    element: <AboutSettings />,
  },
];

function isSettingsSectionId(value: string | undefined): value is SettingsSectionId {
  return SECTIONS.some((section) => section.id === value);
}

export default function SettingsPage() {
  const { section } = useParams<{ section?: string }>();
  const { sidebarOpen, toggleSidebar } = useSidebarUI();

  if (!section) {
    return <Navigate to={toSettings('appearance')} replace />;
  }

  if (!isSettingsSectionId(section)) {
    return <Navigate to={toSettings('appearance')} replace />;
  }

  const activeSection = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div
        className={cn(
          'shrink-0 border-b border-border bg-card px-4 flex items-center gap-3',
          sizeHeightClasses.spacious,
        )}
      >
        {!sidebarOpen && (
          <IconButton
            size="normal"
            icon={<CaretRight size={16} weight="bold" />}
            tooltip="Expand sidebar"
            onClick={toggleSidebar}
          />
        )}
        <Gear size={16} className="text-muted-foreground" />
        <span className="text-sm font-medium">Settings</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/10 md:flex md:flex-col">
          <nav className="flex flex-col gap-0.5 p-2">
            {SECTIONS.map((item) => (
              <NavLink
                key={item.id}
                to={toSettings(item.id)}
                className={({ isActive }) =>
                  cn(
                    'group relative flex h-9 items-center gap-2.5 rounded-md pl-3 pr-2 text-sm',
                    'transition-[background-color,color,transform] duration-150 ease-out',
                    'active:scale-[0.98]',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary',
                        'transition-opacity duration-150 ease-out',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                    />
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
            <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-10">
              {activeSection.element}
            </main>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
