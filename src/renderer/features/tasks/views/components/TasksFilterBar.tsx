import { MagnifyingGlass, X } from '@phosphor-icons/react';
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
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@renderer/components/base/ui/dropdown-menu';
import { cn } from '@renderer/lib/utils';

type GroupByOption = 'state' | 'notebook' | 'note' | 'none';

/**
 * These three are refinements, not primary actions. Given a border and a fill
 * each they read as four equal-weight boxes competing with the search field;
 * as quiet text they recede until wanted and the bar stops looking like a form.
 */
const QUIET_CONTROL =
  'h-8 w-auto gap-1.5 rounded-md border-transparent bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground focus:border-transparent data-[state=open]:bg-muted/60 data-[state=open]:text-foreground';

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
  const allStatesShown = visibleStates.size === taskStates.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-1 px-6 pb-3 pt-4">
      <div className="relative min-w-[200px] flex-1">
        <MagnifyingGlass
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70"
        />
        <Input
          type="text"
          placeholder="Search tasks…"
          aria-label="Search tasks"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && searchQuery) {
              e.stopPropagation();
              setSearchQuery('');
            }
          }}
          className="h-8 rounded-md border-transparent bg-muted/40 pl-8 pr-8 text-[13px] shadow-none hover:bg-muted/60 focus-visible:bg-transparent focus-visible:border-border/70"
        />
        {/* Clearing a search by selecting the text and deleting it is work the
            control should absorb. Escape does the same for keyboard users. */}
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className={cn(
              'absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded',
              'text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out',
              'hover:bg-muted hover:text-foreground active:scale-[0.96]',
              'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring/25',
            )}
          >
            <X size={11} weight="bold" />
          </button>
        )}
      </div>

      {folders.length > 0 && (
        <Select value={folderFilter} onValueChange={setFolderFilter}>
          <SelectTrigger
            aria-label="Filter by notebook"
            className={cn(QUIET_CONTROL, folderFilter !== 'all' && 'text-foreground')}
          >
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
          <button
            type="button"
            className={cn(
              QUIET_CONTROL,
              'inline-flex items-center whitespace-nowrap transition-colors duration-150 ease-out',
              'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring/25',
              !allStatesShown && 'text-foreground',
            )}
          >
            States
            {/* Only worth a number when it is not the default "everything". */}
            {!allStatesShown && (
              <span className="tabular-nums text-muted-foreground">
                {visibleStates.size}/{taskStates.length}
              </span>
            )}
          </button>
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
          {/* These two set the whole selection; they are not independently
              toggleable. Shaped as checkboxes they invited an "uncheck" that
              silently re-ran the same action and appeared to do nothing. */}
          <DropdownMenuItem onSelect={selectAllStates}>All states</DropdownMenuItem>
          <DropdownMenuItem onSelect={selectActiveStates}>Active only</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
        <SelectTrigger aria-label="Group tasks by" className={QUIET_CONTROL}>
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
