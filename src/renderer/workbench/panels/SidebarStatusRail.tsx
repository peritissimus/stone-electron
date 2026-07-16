import { Gear } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { formatShortcut } from '@renderer/services/navigation/useKeyboardShortcuts';
import { toSettings } from '@renderer/services/navigation/routes';
import { GitSyncButton } from './GitSyncButton';

export function SidebarStatusRail() {
  const navigate = useNavigate();

  return (
    <div className="px-2 pb-2 pt-1">
      <GitSyncButton />
      <button
        type="button"
        onClick={() => navigate(toSettings())}
        className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted/60 hover:text-foreground active:scale-[0.96]"
        title={`Settings (${formatShortcut(',', true)})`}
      >
        <span className="flex size-4 items-center justify-center">
          <Gear size={15} />
        </span>
        <span className="leading-4">Settings</span>
      </button>
    </div>
  );
}
