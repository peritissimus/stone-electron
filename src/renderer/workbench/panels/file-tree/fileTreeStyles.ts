import { cn } from '@renderer/lib/utils';

const FILE_TREE_BASE_INSET_PX = 8;
const FILE_TREE_LEVEL_INSET_PX = 16;

export const fileTreeRowClassName = cn(
  'relative flex h-8 w-full items-center rounded-lg pr-2',
  'cursor-pointer text-sm text-left',
  'transition-[background-color,color] duration-150 ease-out',
  'hover:bg-muted/60',
);

export const fileTreeIconClassName =
  'mr-2 size-4 flex-shrink-0 text-muted-foreground transition-colors duration-150';

export const fileTreeLabelClassName =
  'min-w-0 flex-1 truncate leading-4 transition-colors duration-150';

export function getFileTreeRowStyle(level: number): { paddingLeft: string } {
  return {
    paddingLeft: `${FILE_TREE_BASE_INSET_PX + level * FILE_TREE_LEVEL_INSET_PX}px`,
  };
}
