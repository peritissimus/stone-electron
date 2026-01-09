/**
 * TaskExtractor - Pure domain service for extracting tasks from markdown
 *
 * Handles Logseq-style task patterns without any I/O operations.
 * This is pure business logic that can be tested without mocks.
 */

/**
 * Supported task states (Logseq-style)
 */
export type TaskState = 'todo' | 'doing' | 'done' | 'waiting' | 'hold' | 'canceled' | 'idea';

/**
 * Valid task states set for validation
 */
export const VALID_TASK_STATES = new Set<TaskState>([
  'todo',
  'doing',
  'done',
  'waiting',
  'hold',
  'canceled',
  'idea',
]);

/**
 * Raw task extracted from markdown (before enrichment with note metadata)
 */
export interface RawTask {
  index: number;
  state: TaskState;
  text: string;
  lineNumber: number;
  checked: boolean;
}

/**
 * Regex pattern for Logseq-style tasks
 * Matches: "- TODO task text" or "TODO task text"
 * Supported states: TODO, DOING, DONE, WAITING, HOLD, CANCELED, CANCELLED, IDEA
 */
export const TASK_PATTERN =
  /^(\s*)(?:[-*]\s+)?(TODO|DOING|DONE|WAITING|HOLD|CANCELED|CANCELLED|IDEA)\s+(.+)$/gim;

/**
 * TaskExtractor - Pure functions for task extraction and manipulation
 */
export const TaskExtractor = {
  /**
   * Extract all tasks from markdown content
   */
  extractTasks(markdown: string): RawTask[] {
    const tasks: RawTask[] = [];
    const lines = markdown.split('\n');
    const pattern = new RegExp(TASK_PATTERN.source, TASK_PATTERN.flags);

    let taskIndex = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      pattern.lastIndex = 0; // Reset regex state

      const match = pattern.exec(line);
      if (match) {
        const stateRaw = match[2].toLowerCase();
        const state: TaskState = stateRaw === 'cancelled' ? 'canceled' : (stateRaw as TaskState);
        const text = match[3].trim();
        const checked = state === 'done' || state === 'canceled';

        if (text) {
          tasks.push({
            index: taskIndex,
            state,
            text,
            lineNumber: lineNum + 1, // 1-based line numbers
            checked,
          });
          taskIndex++;
        }
      }
    }

    return tasks;
  },

  /**
   * Replace a task's state at a specific index
   * Returns the updated markdown content
   */
  replaceTaskState(markdown: string, taskIndex: number, newState: TaskState): string {
    if (!VALID_TASK_STATES.has(newState)) {
      throw new Error(`Invalid task state: ${newState}`);
    }

    let currentIndex = 0;
    let found = false;

    const result = markdown.replace(
      TASK_PATTERN,
      (match, indent, _state, text) => {
        if (currentIndex === taskIndex) {
          found = true;
          // Preserve the list marker if present, otherwise add one
          const hasListMarker = /^(\s*)[-*]\s+/.test(match);
          const prefix = hasListMarker ? `${indent}- ` : `${indent}`;
          currentIndex++;
          return `${prefix}${newState.toUpperCase()} ${text}`;
        }
        currentIndex++;
        return match;
      }
    );

    if (!found) {
      throw new Error(`Task at index ${taskIndex} not found`);
    }

    return result;
  },

  /**
   * Check if a state represents a "completed" task
   */
  isCompletedState(state: TaskState): boolean {
    return state === 'done' || state === 'canceled';
  },

  /**
   * Validate a task state string
   */
  isValidState(state: string): state is TaskState {
    return VALID_TASK_STATES.has(state.toLowerCase() as TaskState);
  },

  /**
   * Normalize a state string (handle 'cancelled' -> 'canceled')
   */
  normalizeState(state: string): TaskState {
    const lower = state.toLowerCase();
    if (lower === 'cancelled') return 'canceled';
    if (!VALID_TASK_STATES.has(lower as TaskState)) {
      throw new Error(`Invalid task state: ${state}`);
    }
    return lower as TaskState;
  },
};
