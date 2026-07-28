import { ArrowLeft, ArrowRight, SidebarSimple } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { isMacOS } from '@renderer/services/navigation/useKeyboardShortcuts';
import { isWebTransport } from '@renderer/lib/transport';
import { cn } from '@renderer/lib/utils';

interface TitlebarNavigationControlsProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  className?: string;
}

/** Clears the macOS traffic lights, which only exist in the Electron window. */
const EXPANDED_TITLEBAR_CONTROLS_INSET_PX = 84;

/**
 * Matches the sidebar list's own gutter (`px-2`), so the toggle's icon lands on
 * the same vertical rail as the nav icons directly beneath it. Flush against
 * left-0 the toggle reads as hanging outside the column.
 */
const SIDEBAR_GUTTER_PX = 8;

export function TitlebarNavigationControls({
  sidebarOpen,
  toggleSidebar,
  className,
}: TitlebarNavigationControlsProps) {
  const navigate = useNavigate();
  const onWeb = isWebTransport();
  const buttonClassName =
    'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted/70 hover:text-foreground active:scale-[0.96] disabled:opacity-35';

  return (
    <div
      className={cn('flex h-10 shrink-0 items-center gap-0.5', className)}
      // In a browser there are no traffic lights to clear, so the inset would
      // just be dead space pushing the toggle away from the edge.
      style={{
        marginLeft:
          isMacOS() && !onWeb ? EXPANDED_TITLEBAR_CONTROLS_INSET_PX : SIDEBAR_GUTTER_PX,
      }}
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

      {/* The browser already has back and forward, and its buttons stay in sync
          with history in ways an in-app pair cannot. Only Electron needs these. */}
      {!onWeb && (
        <>
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
        </>
      )}
    </div>
  );
}
