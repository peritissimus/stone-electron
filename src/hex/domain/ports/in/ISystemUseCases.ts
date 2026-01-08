/**
 * System Use Cases Port
 *
 * Defines the contract for system-level operations.
 */

// Request/Response types
export interface GetFontsResponse {
  fonts: string[];
}

// Use case interfaces
export interface IGetSystemFontsUseCase {
  execute(): Promise<GetFontsResponse>;
}
