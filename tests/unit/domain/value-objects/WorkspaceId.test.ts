/**
 * WorkspaceId Value Object Tests
 *
 * Immutable value object - no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { WorkspaceId } from '../../../../src/main/domain/value-objects/WorkspaceId';

describe('WorkspaceId', () => {
  describe('fromString', () => {
    it('creates WorkspaceId from valid string', () => {
      const workspaceId = WorkspaceId.fromString('workspace-123');

      expect(workspaceId.value).toBe('workspace-123');
    });

    it('trims whitespace', () => {
      const workspaceId = WorkspaceId.fromString('  workspace-123  ');

      expect(workspaceId.value).toBe('workspace-123');
    });

    it('throws on empty string', () => {
      expect(() => WorkspaceId.fromString('')).toThrow('WorkspaceId cannot be empty');
    });

    it('throws on whitespace-only string', () => {
      expect(() => WorkspaceId.fromString('   ')).toThrow('WorkspaceId cannot be empty');
    });
  });

  describe('value getter', () => {
    it('returns the id value', () => {
      const workspaceId = WorkspaceId.fromString('abc-123');

      expect(workspaceId.value).toBe('abc-123');
    });
  });

  describe('equals', () => {
    it('returns true for equal ids', () => {
      const a = WorkspaceId.fromString('workspace-1');
      const b = WorkspaceId.fromString('workspace-1');

      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different ids', () => {
      const a = WorkspaceId.fromString('workspace-1');
      const b = WorkspaceId.fromString('workspace-2');

      expect(a.equals(b)).toBe(false);
    });

    it('returns false for null', () => {
      const workspaceId = WorkspaceId.fromString('workspace-1');

      expect(workspaceId.equals(null as unknown as WorkspaceId)).toBe(false);
    });

    it('returns false for undefined', () => {
      const workspaceId = WorkspaceId.fromString('workspace-1');

      expect(workspaceId.equals(undefined as unknown as WorkspaceId)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns string representation', () => {
      const workspaceId = WorkspaceId.fromString('workspace-123');

      expect(workspaceId.toString()).toBe('workspace-123');
    });

    it('can be used in string contexts', () => {
      const workspaceId = WorkspaceId.fromString('workspace-123');

      expect(`ID: ${workspaceId}`).toBe('ID: workspace-123');
    });
  });
});
