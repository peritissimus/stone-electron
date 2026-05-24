import { ArrowRight, FileText } from 'phosphor-react';
import type { CitationSource } from '@shared/types';

export interface SourceCitationListProps {
  sources: CitationSource[];
  onOpen: (noteId: string) => void;
}

export function SourceCitationList({ sources, onOpen }: SourceCitationListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        Sources <span className="tabular-nums">({sources.length})</span>
      </div>
      <div className="-mx-2 flex flex-col">
        {sources.map((source, index) => {
          const headingPath = source.headingPath?.length
            ? source.headingPath.join(' › ')
            : undefined;
          return (
            <button
              key={`${source.noteId}:${source.chunkId}`}
              type="button"
              onClick={() => onOpen(source.noteId)}
              className={[
                'group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left',
                'hover:bg-accent/50',
                'transition-[background-color,transform] duration-150 ease-out active:scale-[0.98]',
              ].join(' ')}
            >
              <span className="flex-shrink-0 text-muted-foreground">
                <FileText size={14} weight="regular" />
              </span>
              <span className="text-[11px] font-mono text-muted-foreground/70 tabular-nums">
                [{index + 1}]
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">
                  {source.title || 'Untitled'}
                </div>
                {(headingPath || source.excerpt) && (
                  <div className="truncate text-xs text-muted-foreground">
                    {headingPath ?? source.excerpt}
                  </div>
                )}
              </div>
              <ArrowRight
                size={12}
                className="flex-shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
