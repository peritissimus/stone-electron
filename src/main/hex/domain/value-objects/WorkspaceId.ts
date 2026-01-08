/**
 * WorkspaceId Value Object
 *
 * Represents a unique identifier for a Workspace.
 *
 * PURE DOMAIN - No external dependencies.
 */

export class WorkspaceId {
  private readonly _value: string;

  private constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('WorkspaceId cannot be empty');
    }
    this._value = value.trim();
  }

  static fromString(value: string): WorkspaceId {
    return new WorkspaceId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: WorkspaceId): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
