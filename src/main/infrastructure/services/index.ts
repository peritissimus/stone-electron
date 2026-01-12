/**
 * Infrastructure Services
 *
 * Note: MarkdownService has been moved to adapters/out/services/MarkdownProcessor
 * following hexagonal architecture (adapters contain external library implementations)
 */

export {
  EmbeddingWorkerService,
  getEmbeddingWorkerService,
  createEmbeddingWorkerService,
} from './EmbeddingWorkerService';

export { getMLStatusService, createMLStatusService } from './MLStatusService';

export {
  PerformanceMonitor,
  getPerformanceMonitor,
  type PerformanceSnapshot,
  type StartupMetrics,
  type MemoryMetrics,
  type CPUMetrics,
  type EventLoopMetrics,
  type IPCMetrics,
  type DatabaseMetrics,
  type ChannelStats,
  type OperationStats,
} from './PerformanceMonitor';
