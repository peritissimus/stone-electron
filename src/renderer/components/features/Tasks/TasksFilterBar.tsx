import { MagnifyingGlass, FolderOpen, Funnel, Stack } from '@phosphor-icons/react';
import { Input } from '@renderer/components/base/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@renderer/components/base/ui/dropdown-menu';
import { Button } from '@renderer/components/base/ui/button';
import { cn } from '@renderer/lib/utils';

type GroupByOption = 'state' | 'notebook' | 'note' | 'none';

interface TasksFilterBarProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  folders: string[];
  folderFilter: string;
  setFolderFilter: (v: string) => void;
  visibleStates: Set<string>;
  toggleStateVisibility: (stateKey: string) => void;
  selectAllStates: () => void;
  selectActiveStates: () => void;
  taskStates: readonly { key: string; label: string; color: string; done: boolean }[];
  groupBy: GroupByOption;
  setGroupBy: (v: GroupByOption) => void;
}

export function TasksFilterBar({
  searchQuery,
  setSearchQuery,
  folders,
  folderFilter,
  setFolderFilter,
  visibleStates,
  toggleStateVisibility,
  selectAllStates,
  selectActiveStates,
  taskStates,
  groupBy,
  setGroupBy,
}: TasksFilterBarProps) {
  const activeStates = taskStates.filter((s) => !s.done);
  const allActiveSelected =
    visibleStates.size === activeStates.length &&
    activeStates.every((s) => visibleStates.has(s.key));

  return (
    <div className="px-4 py-2 border-b border-border bg-card/50 flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-8"
        />
      </div>

      {folders.length > 0 && (
        <Select value={folderFilter} onValueChange={setFolderFilter}>
          <SelectTrigger className={cn('w-[140px] h-8')}>
            <FolderOpen className="size-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All notebooks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All notebooks</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder} value={folder}>
                {folder}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Funnel size={16} />
            States
            <span className="text-xs text-muted-foreground">
              ({visibleStates.size}/{taskStates.length})
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Show States</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {taskStates.map((state) => (
            <DropdownMenuCheckboxItem
              key={state.key}
              checked={visibleStates.has(state.key)}
              onCheckedChange={() => toggleStateVisibility(state.key)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${state.color}`} />
                {state.label}
              </div>
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={visibleStates.size === taskStates.length}
            onCheckedChange={selectAllStates}
          >
            All states
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={allActiveSelected} onCheckedChange={selectActiveStates}>
            Active only
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
        <SelectTrigger className="w-[140px] h-8">
          <Stack size={16} className="mr-2 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="state">By State</SelectItem>
          <SelectItem value="notebook">By Notebook</SelectItem>
          <SelectItem value="note">By Note</SelectItem>
          <SelectItem value="none">No Grouping</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
