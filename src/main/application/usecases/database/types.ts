/**
 * Shape of the low-level DatabaseManager adapter that the database use
 * cases consume. Intentionally narrower than the wire response — the
 * use cases enrich this with counts from the repositories.
 */
export interface DatabaseManager {
  getStatus(): Promise<{ path: string; size: number; isOpen: boolean }>;
  vacuum(): Promise<void>;
  checkIntegrity(): Promise<{ ok: boolean; errors: string[] }>;
}
