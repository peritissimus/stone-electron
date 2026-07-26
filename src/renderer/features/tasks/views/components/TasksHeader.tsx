import { ViewHeader } from '@renderer/components/composites';

interface TasksHeaderProps {
  counts: { visible: number; total: number; active: number; completed: number };
}

/**
 * "0 of 15 tasks" names a number without saying what makes the difference — the
 * reader cannot tell a filtered-out task from a finished one. The active/done
 * split describes the actual workload and holds true whichever states are shown.
 */
export function TasksHeader({ counts }: TasksHeaderProps) {
  const meta =
    counts.total === 0
      ? undefined
      : `${counts.active} active · ${counts.completed} done`;

  return <ViewHeader title="Tasks" meta={meta} />;
}
