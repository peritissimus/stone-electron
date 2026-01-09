/**
 * Version DTOs - Data transfer objects for note version history
 */

/**
 * Version response
 */
export interface VersionDTO {
  id: string;
  noteId: string;
  versionNumber: number;
  title: string;
  contentPreview: string;
  createdAt: string;
  sizeBytes: number;
}

/**
 * Version detail (with full content)
 */
export interface VersionDetailDTO extends VersionDTO {
  content: string;
}

/**
 * Get versions request
 */
export interface GetVersionsRequestDTO {
  noteId: string;
  limit?: number;
  offset?: number;
}

/**
 * Get versions response
 */
export interface GetVersionsResponseDTO {
  versions: VersionDTO[];
  total: number;
}

/**
 * Create version request
 */
export interface CreateVersionRequestDTO {
  noteId: string;
}

/**
 * Restore version request
 */
export interface RestoreVersionRequestDTO {
  noteId: string;
  versionId: string;
}

/**
 * Compare versions request
 */
export interface CompareVersionsRequestDTO {
  versionIdA: string;
  versionIdB: string;
}

/**
 * Compare versions response
 */
export interface CompareVersionsResponseDTO {
  versionA: VersionDetailDTO;
  versionB: VersionDetailDTO;
  diff: string; // Unified diff format
}
