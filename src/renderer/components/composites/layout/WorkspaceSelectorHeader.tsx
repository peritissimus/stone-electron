import { CaretLeft } from '@phosphor-icons/react';
import { Text } from '@renderer/components/base/ui/text';
import { useUI } from '@renderer/hooks/useUI';
import { useWorkspaces } from '@renderer/hooks/useWorkspaces';
import { sizeHeightClasses, sizePaddingClasses } from '@renderer/components/composites';
import { cn } from '@renderer/lib/utils';

export function WorkspaceSelectorHeader() {
  const { workspaces, activeWorkspaceId } = useWorkspaces();
  const { toggleSidebar } = useUI();
  const activeWorkspaceName = workspaces.find((w) => w.id === activeWorkspaceId)?.name;

  return (
    <div
      className={cn(
        'flex w-full items-center gap-1 border-b border-border',
        sizeHeightClasses['spacious'],
        sizePaddingClasses['compact'],
      )}
    >
      <div className="flex-1 px-2">
        <Text size="sm" weight="medium" className="truncate">
          {activeWorkspaceName || 'Select workspace'}
        </Text>
      </div>
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex items-center justify-center size-6 rounded hover:bg-accent/50 transition-[background-color,scale] duration-150 ease-out active:scale-[0.96]"
        title="Collapse sidebar"
      >
        <CaretLeft size={14} weight="bold" />
      </button>
    </div>
  );
}
