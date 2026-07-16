import { ArrowLeft, ArrowRight, SidebarSimple } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { isMacOS } from '@renderer/services/navigation/useKeyboardShortcuts';
import { cn } from '@renderer/lib/utils';

interface TitlebarNavigationControlsProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  className?: string;
}

const EXPANDED_TITLEBAR_CONTROLS_INSET_PX = 84;

export function TitlebarNavigationControls({
  sidebarOpen,
  toggleSidebar,
  className,
}: TitlebarNavigationControlsProps) {
  const navigate = useNavigate();
  const buttonClassName =
    'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted/70 hover:text-foreground active:scale-[0.96] disabled:opacity-35';

  return (
    <div
      className={cn('flex h-10 shrink-0 items-center gap-0.5', className)}
      style={isMacOS() ? { marginLeft: EXPANDED_TITLEBAR_CONTROLS_INSET_PX } : undefined}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        className={buttonClassName}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <SidebarSimple size={16} />
      </button>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className={buttonClassName}
        title="Go back"
        aria-label="Go back"
      >
        <ArrowLeft size={15} />
      </button>
      <button
        type="button"
        onClick={() => navigate(1)}
        className={buttonClassName}
        title="Go forward"
        aria-label="Go forward"
      >
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
