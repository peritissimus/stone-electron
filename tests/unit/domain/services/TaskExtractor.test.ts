/**
 * TaskExtractor Domain Service Tests
 *
 * Pure function tests - no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import {
  TaskExtractor,
  type TaskState,
} from '../../../../src/main/domain/services/TaskExtractor';

describe('TaskExtractor', () => {
  describe('extractTasks', () => {
    it('extracts TODO tasks', () => {
      const markdown = 'TODO Buy groceries';
      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        text: 'Buy groceries',
        state: 'todo',
        checked: false,
        lineNumber: 1,
      });
    });

    it('extracts DOING tasks', () => {
      const markdown = 'DOING Working on feature';
      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].state).toBe('doing');
      expect(tasks[0].checked).toBe(false);
    });

    it('extracts DONE tasks as checked', () => {
      const markdown = 'DONE Completed task';
      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].state).toBe('done');
      expect(tasks[0].checked).toBe(true);
    });

    it('extracts CANCELED tasks as checked', () => {
      const markdown = 'CANCELED Abandoned task';
      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].state).toBe('canceled');
      expect(tasks[0].checked).toBe(true);
    });

    it('normalizes CANCELLED to canceled', () => {
      const markdown = 'CANCELLED Old spelling';
      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks[0].state).toBe('canceled');
    });

    it('extracts all supported states', () => {
      const markdown = `
TODO Task 1
DOING Task 2
DONE Task 3
WAITING Task 4
HOLD Task 5
CANCELED Task 6
IDEA Task 7
      `.trim();

      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toHaveLength(7);
      expect(tasks.map((t) => t.state)).toEqual([
        'todo',
        'doing',
        'done',
        'waiting',
        'hold',
        'canceled',
        'idea',
      ]);
    });

    it('extracts tasks with list markers', () => {
      const markdown = `
- TODO List item task
* TODO Asterisk task
      `.trim();

      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].text).toBe('List item task');
      expect(tasks[1].text).toBe('Asterisk task');
    });

    it('preserves indentation info', () => {
      const markdown = '  - TODO Indented task';
      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Indented task');
    });

    it('tracks line numbers correctly', () => {
      const markdown = `Line 1
TODO Task on line 2
Line 3
TODO Task on line 4`;

      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].lineNumber).toBe(2);
      expect(tasks[1].lineNumber).toBe(4);
    });

    it('returns empty array for no tasks', () => {
      const markdown = 'Just regular text\nNo tasks here';
      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toEqual([]);
    });

    it('is case insensitive for keywords', () => {
      const markdown = `
todo lowercase
Todo Mixed
TODO UPPER
      `.trim();

      const tasks = TaskExtractor.extractTasks(markdown);

      expect(tasks).toHaveLength(3);
      expect(tasks.every((t) => t.state === 'todo')).toBe(true);
    });

    it('handles empty content', () => {
      expect(TaskExtractor.extractTasks('')).toEqual([]);
    });
  });

  describe('replaceTaskState', () => {
    it('replaces task state by index', () => {
      const markdown = 'TODO First task';
      const result = TaskExtractor.replaceTaskState(markdown, 0, 'done');

      expect(result).toBe('DONE First task');
    });

    it('preserves list markers when replacing', () => {
      const markdown = '- TODO List task';
      const result = TaskExtractor.replaceTaskState(markdown, 0, 'doing');

      expect(result).toBe('- DOING List task');
    });

    it('preserves indentation when replacing', () => {
      const markdown = '  - TODO Indented';
      const result = TaskExtractor.replaceTaskState(markdown, 0, 'done');

      expect(result).toBe('  - DONE Indented');
    });

    it('replaces correct task in multi-task content', () => {
      const markdown = `TODO First
TODO Second
TODO Third`;

      const result = TaskExtractor.replaceTaskState(markdown, 1, 'done');

      expect(result).toContain('TODO First');
      expect(result).toContain('DONE Second');
      expect(result).toContain('TODO Third');
    });

    it('throws on invalid task index', () => {
      const markdown = 'TODO Only one task';

      expect(() => TaskExtractor.replaceTaskState(markdown, 5, 'done')).toThrow();
    });

    it('throws on negative index', () => {
      const markdown = 'TODO Task';

      expect(() => TaskExtractor.replaceTaskState(markdown, -1, 'done')).toThrow();
    });

    it('throws on invalid task state', () => {
      const markdown = 'TODO Task';

      expect(() =>
        TaskExtractor.replaceTaskState(markdown, 0, 'invalid' as 'todo')
      ).toThrow('Invalid task state: invalid');
    });
  });

  describe('isCompletedState', () => {
    it('returns true for done', () => {
      expect(TaskExtractor.isCompletedState('done')).toBe(true);
    });

    it('returns true for canceled', () => {
      expect(TaskExtractor.isCompletedState('canceled')).toBe(true);
    });

    it('returns false for todo', () => {
      expect(TaskExtractor.isCompletedState('todo')).toBe(false);
    });

    it('returns false for doing', () => {
      expect(TaskExtractor.isCompletedState('doing')).toBe(false);
    });

    it('returns false for waiting', () => {
      expect(TaskExtractor.isCompletedState('waiting')).toBe(false);
    });
  });

  describe('isValidState', () => {
    it('returns true for all valid states', () => {
      const validStates: TaskState[] = ['todo', 'doing', 'done', 'waiting', 'hold', 'canceled', 'idea'];

      validStates.forEach((state) => {
        expect(TaskExtractor.isValidState(state)).toBe(true);
      });
    });

    it('returns false for invalid states', () => {
      expect(TaskExtractor.isValidState('invalid')).toBe(false);
      expect(TaskExtractor.isValidState('')).toBe(false);
      // Note: isValidState normalizes to lowercase, so DONE is valid
      expect(TaskExtractor.isValidState('DONE')).toBe(true);
      expect(TaskExtractor.isValidState('notastate')).toBe(false);
    });
  });

  describe('normalizeState', () => {
    it('normalizes cancelled to canceled', () => {
      expect(TaskExtractor.normalizeState('cancelled')).toBe('canceled');
    });

    it('passes through valid states', () => {
      expect(TaskExtractor.normalizeState('todo')).toBe('todo');
      expect(TaskExtractor.normalizeState('done')).toBe('done');
    });

    it('throws on invalid state', () => {
      expect(() => TaskExtractor.normalizeState('invalid')).toThrow();
    });
  });
});
