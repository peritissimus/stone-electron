import { ArrowsClockwise } from 'phosphor-react';
import { Button } from '@renderer/components/base/ui/button';
import { Checkbox } from '@renderer/components/base/ui/checkbox';
import { Label } from '@renderer/components/base/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/base/ui/popover';
import { cn } from '@renderer/lib/utils';

export function ReclassifyPopover({
  excludeJournal,
  setExcludeJournal,
  classifying,
  onReclassify,
}: {
  excludeJournal: boolean;
  setExcludeJournal: (v: boolean) => void;
  classifying: boolean;
  onReclassify: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={classifying}
          className="h-7 px-2 text-xs"
          title="Reclassify options"
        >
          <ArrowsClockwise size={14} className={cn(classifying && 'animate-spin')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="space-y-3">
          <div className="text-sm font-medium">Reclassify Options</div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="exclude-journal"
              checked={excludeJournal}
              onCheckedChange={(checked) => setExcludeJournal(checked === true)}
            />
            <Label htmlFor="exclude-journal" className="text-xs cursor-pointer">
              Exclude Journal notes
            </Label>
          </div>
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={onReclassify}
            disabled={classifying}
          >
            {classifying ? 'Reclassifying...' : 'Reclassify All'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
