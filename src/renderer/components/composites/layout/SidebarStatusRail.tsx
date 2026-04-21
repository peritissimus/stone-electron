import { MLStatusIndicator } from '@renderer/components/features/MLStatus';
import { GitSyncButton } from './GitSyncButton';

export function SidebarStatusRail() {
  return (
    <>
      <GitSyncButton />
      <MLStatusIndicator />
    </>
  );
}
