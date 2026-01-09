/**
 * HexColor Value Object
 *
 * Represents a valid hex color code.
 *
 * PURE DOMAIN - No external dependencies.
 */

export class HexColor {
  private readonly _value: string;

  private constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) {
      throw new Error(`Invalid hex color format: ${value}. Use format #RRGGBB`);
    }
    this._value = normalized;
  }

  static fromString(value: string): HexColor {
    return new HexColor(value);
  }

  static fromRGB(r: number, g: number, b: number): HexColor {
    const toHex = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, '0');
    return new HexColor(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
  }

  get value(): string {
    return this._value;
  }

  get rgb(): { r: number; g: number; b: number } {
    return {
      r: parseInt(this._value.slice(1, 3), 16),
      g: parseInt(this._value.slice(3, 5), 16),
      b: parseInt(this._value.slice(5, 7), 16),
    };
  }

  equals(other: HexColor): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
