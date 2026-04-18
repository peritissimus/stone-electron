/**
 * Service Adapters Index
 */

export { MarkdownProcessor } from './MarkdownProcessor';
export { SearchEngine, type SearchEngineDeps } from './SearchEngine';
export { EmbeddingService, type EmbeddingServiceDeps } from './EmbeddingService';
export { ExportService } from './ExportService';
export { SystemService } from './SystemService';
export { GitService } from './GitService';
export { FileWatcherService } from './FileWatcherService';
export { PerformanceMonitor, getPerformanceMonitor } from './PerformanceMonitor';
export {
  EmbeddingWorkerService,
  getEmbeddingWorkerService,
  createEmbeddingWorkerService,
} from './EmbeddingWorkerService';
export { getMLStatusService, createMLStatusService } from './MLStatusService';
