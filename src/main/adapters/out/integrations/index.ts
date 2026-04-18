/**
 * Service Adapters Index
 */

export { MarkdownProcessor } from './MarkdownProcessor';
export { SearchEngine, type SearchEngineDeps } from './SearchEngine';
export { Embedder, type EmbedderDeps } from './Embedder';
export { Exporter } from './Exporter';
export { SystemBridge } from './SystemBridge';
export { GitClient } from './GitClient';
export { FileWatcher } from './FileWatcher';
export { PerformanceMonitor, getPerformanceMonitor } from './PerformanceMonitor';
export {
  EmbeddingWorker,
  getEmbeddingWorker,
  createEmbeddingWorker,
} from './EmbeddingWorker';
export { getMLStatusTracker, createMLStatusTracker } from './MLStatusTracker';
